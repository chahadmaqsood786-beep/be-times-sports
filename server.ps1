param(
    [int]$Port = 3000,
    [string]$Path = $PSScriptRoot
)
if (-not $Path) {
    $Path = "C:\Users\Saleem\.gemini\antigravity\scratch\stitch_gorsy_garments_3d_customizer"
}

# 1. Load Environment Variables from .env if present
$envFile = Join-Path $Path ".env"
$destinationEmail = "chahadmaqsood786@gmail.com"
$resendApiKey = ""
$resendFromEmail = "GORSY Export Desk <onboarding@resend.dev>"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if ($k -eq "PORT" -and [int]::TryParse($v, [ref]$Port)) {}
            if ($k -eq "INQUIRY_DESTINATION_EMAIL" -and $v) { $destinationEmail = $v }
            if ($k -eq "RESEND_API_KEY" -and $v) { $resendApiKey = $v }
            if ($k -eq "RESEND_FROM_EMAIL" -and $v) { $resendFromEmail = $v }
        }
    }
}

# Also check system environment variables
if (-not $resendApiKey -and $env:RESEND_API_KEY) {
    $resendApiKey = $env:RESEND_API_KEY
}

# Rate limiting storage (IP -> list of submission timestamps)
$rateLimitStore = @{}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "==============================================================="
Write-Host " GORSY B2B MANUFACTURING - MULTI-PAGE HTTP & EMAIL SERVER"
Write-Host " Listening on: $prefix"
Write-Host " Serving Root: $Path"
Write-Host " Notification Target: $destinationEmail"
if ($resendApiKey) {
    Write-Host " Resend API: Configured (Live email sending enabled)"
} else {
    Write-Host " Resend API: NOT CONFIGURED (Inquiries will be saved to inquiries.json)"
    Write-Host " (To enable live emails, add RESEND_API_KEY=re_... in .env)"
}
Write-Host "==============================================================="

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".xml"  = "application/xml; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
}

# Clean URL route mapping
$cleanRoutes = @{
    "/"               = "index.html"
    "/home"           = "index.html"
    "/sportswear"     = "sportswear.html"
    "/activewear"     = "activewear.html"
    "/schoolwear"     = "schoolwear.html"
    "/sports-goods"   = "sports-goods.html"
    "/products"       = "products.html"
    "/3d-customizer"  = "3d-customizer.html"
    "/manufacturing"  = "manufacturing.html"
    "/private-label"  = "private-label.html"
    "/about"          = "about.html"
    "/tech-pack"      = "tech-pack.html"
    "/contact"        = "contact.html"
    "/sitemap.xml"    = "sitemap.xml"
    "/robots.txt"     = "robots.txt"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers for API requests
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Accept")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.OutputStream.Close()
            continue
        }

        $rawUrl = $request.Url.LocalPath.ToLower().TrimEnd('/')
        if ([string]::IsNullOrWhiteSpace($rawUrl)) { $rawUrl = "/" }

        # -------------------------------------------------------------
        # API ENDPOINT: POST /api/send-inquiry
        # -------------------------------------------------------------
        if ($rawUrl -eq "/api/send-inquiry" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $clientIp = $request.RemoteEndPoint.Address.ToString()
                $now = [DateTime]::UtcNow

                # Rate limiting check: max 5 requests per minute per IP
                if (-not $rateLimitStore.ContainsKey($clientIp)) {
                    $rateLimitStore[$clientIp] = [System.Collections.Generic.List[DateTime]]::new()
                }
                $timestamps = $rateLimitStore[$clientIp]
                $timestamps.RemoveAll([Predicate[DateTime]]{ param($t) ($now - $t).TotalSeconds -gt 60 })
                
                if ($timestamps.Count -ge 5) {
                    $response.StatusCode = 429
                    $response.ContentType = "application/json; charset=utf-8"
                    $errJson = '{"success":false,"error":"Too many requests. Please wait a minute before submitting again."}'
                    $b = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                    $response.OutputStream.Write($b, 0, $b.Length)
                    $response.OutputStream.Close()
                    continue
                }
                $timestamps.Add($now)

                $inquiry = $bodyText | ConvertFrom-Json
                $ticketId = "GOR-" + (Get-Date -Format "yyyyMMdd-HHmmss")

                # Validate required fields
                if (-not $inquiry.fullName -or -not $inquiry.email -or -not $inquiry.message) {
                    $response.StatusCode = 400
                    $response.ContentType = "application/json; charset=utf-8"
                    $errJson = '{"success":false,"error":"Validation failed: Name, Email, and Message are required."}'
                    $b = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                    $response.OutputStream.Write($b, 0, $b.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $inquiryType = if ($inquiry.inquiryType) { $inquiry.inquiryType.ToUpper() } else { "GENERAL INQUIRY" }
                $subject = "NEW $inquiryType INQUIRY - GORSY WEBSITE [$ticketId]"

                # Persist to local inquiries.json log
                $inquiriesFile = Join-Path $Path "inquiries.json"
                $existingInquiries = @()
                if (Test-Path $inquiriesFile) {
                    try {
                        $rawInq = [System.IO.File]::ReadAllText($inquiriesFile, [System.Text.Encoding]::UTF8)
                        $existingInquiries = $rawInq | ConvertFrom-Json
                        if ($existingInquiries -isnot [System.Collections.IEnumerable]) {
                            $existingInquiries = @($existingInquiries)
                        }
                    } catch {}
                }
                $logEntry = [PSCustomObject]@{
                    TicketId     = $ticketId
                    Timestamp    = (Get-Date -Format "o")
                    InquiryType  = $inquiryType
                    FullName     = $inquiry.fullName
                    Company      = $inquiry.companyName
                    Email        = $inquiry.email
                    Phone        = $inquiry.phone
                    Country      = $inquiry.country
                    Category     = $inquiry.productCategory
                    ProductName  = $inquiry.productName
                    Quantity     = $inquiry.quantity
                    DeliveryDate = $inquiry.deliveryDate
                    Specs        = $inquiry.customizationSpecs
                    Message      = $inquiry.message
                    SwatchKit    = $inquiry.swatchKitRequested
                    ClientIp     = $clientIp
                }
                $newInqList = @($existingInquiries) + $logEntry
                $jsonLog = $newInqList | ConvertTo-Json -Depth 5
                [System.IO.File]::WriteAllText($inquiriesFile, $jsonLog, [System.Text.Encoding]::UTF8)

                # Attempt Email Dispatch via Resend API
                $emailSent = $false
                $emailError = ""

                if ($resendApiKey) {
                    try {
                        $htmlBody = @"
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0e14; color: #dfe2eb; margin: 0; padding: 24px; }
  .card { background-color: #121720; border: 1px solid #334155; border-radius: 12px; padding: 28px; max-width: 680px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
  .header { border-bottom: 2px solid #00e5ff; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 2px; }
  .badge { display: inline-block; background-color: #00363d; color: #00e5ff; border: 1px solid #00e5ff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-left: 8px; }
  .ticket { font-size: 13px; color: #cdff13; font-weight: 600; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #1e293b; width: 35%; }
  td { padding: 10px; font-size: 13px; color: #ffffff; border-bottom: 1px solid #1e293b; }
  .highlight { color: #00e5ff; font-weight: bold; }
  .msg-box { background-color: #06090e; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin-top: 20px; font-size: 13px; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap; }
  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <span class="brand">GORSY</span>
        <span class="badge">$inquiryType</span>
      </div>
      <div class="ticket">REFERENCE TICKET: $ticketId</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Submitted on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss") UTC</div>
    </div>

    <table>
      <tr><th>Customer Name</th><td class="highlight">$($inquiry.fullName)</td></tr>
      <tr><th>Corporate / Brand Name</th><td>$($inquiry.companyName)</td></tr>
      <tr><th>Corporate Email</th><td><a href="mailto:$($inquiry.email)" style="color: #00e5ff;">$($inquiry.email)</a></td></tr>
      <tr><th>Phone / WhatsApp</th><td>$($inquiry.phone)</td></tr>
      <tr><th>Destination Country</th><td>$($inquiry.country)</td></tr>
      <tr><th>Product Category</th><td>$($inquiry.productCategory)</td></tr>
      <tr><th>Product Line / SKU</th><td>$($inquiry.productName)</td></tr>
      <tr><th>Target Order Volume</th><td class="highlight">$($inquiry.quantity)</td></tr>
      <tr><th>Required Delivery Date</th><td>$($inquiry.deliveryDate)</td></tr>
      <tr><th>Customization Requirements</th><td>$($inquiry.customizationSpecs)</td></tr>
      <tr><th>Physical Swatch Kit Requested</th><td>$(if ($inquiry.swatchKitRequested) { "YES (Air Express Swatches Required)" } else { "No" })</td></tr>
    </table>

    <div style="margin-top: 20px; font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Buyer Specifications & Message:</div>
    <div class="msg-box">$($inquiry.message)</div>

    <div class="footer">
      GORSY Garments (Pvt) Ltd • Sialkot Export Processing Zone (EPZ), Punjab, Pakistan<br/>
      Direct Dispatch to: $destinationEmail • Auto-logged to inquiries.json
    </div>
  </div>
</body>
</html>
"@

                        $resendPayload = @{
                            from    = $resendFromEmail
                            to      = @($destinationEmail)
                            subject = $subject
                            html    = $htmlBody
                        } | ConvertTo-Json

                        $resendHeaders = @{
                            "Authorization" = "Bearer $resendApiKey"
                            "Content-Type"  = "application/json"
                        }

                        $resendResponse = Invoke-RestMethod -Uri "https://api.resend.com/emails" -Method Post -Headers $resendHeaders -Body $resendPayload
                        $emailSent = $true
                        Write-Host "[EMAIL SENT] Inquiry $ticketId delivered via Resend to $destinationEmail"
                    } catch {
                        $emailError = $_.Exception.Message
                        Write-Host "[EMAIL ERROR] Resend call failed: $emailError"
                    }
                }

                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"

                $respObj = [PSCustomObject]@{
                    success      = $true
                    ticketId     = $ticketId
                    emailSent    = $emailSent
                    unconfigured = (-not $resendApiKey)
                    message      = if ($emailSent) {
                        "Your inquiry has been registered and emailed directly to our export desk ($destinationEmail)."
                    } elseif (-not $resendApiKey) {
                        "Your inquiry was logged successfully (Ticket $ticketId). Note: Configure RESEND_API_KEY in .env to activate live transactional emails."
                    } else {
                        "Inquiry logged. (Email dispatch error: $emailError)"
                    }
                }

                $respBytes = [System.Text.Encoding]::UTF8.GetBytes(($respObj | ConvertTo-Json))
                $response.OutputStream.Write($respBytes, 0, $respBytes.Length)
                $response.OutputStream.Close()
                continue
            } catch {
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $errObj = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
                $b = [System.Text.Encoding]::UTF8.GetBytes($errObj)
                $response.OutputStream.Write($b, 0, $b.Length)
                $response.OutputStream.Close()
                continue
            }
        }

        # -------------------------------------------------------------
        # STATIC & CLEAN URL ROUTING
        # -------------------------------------------------------------
        $targetFile = $null

        if ($cleanRoutes.ContainsKey($rawUrl)) {
            $targetFile = Join-Path $Path $cleanRoutes[$rawUrl]
        } else {
            $decoded = [System.Uri]::UnescapeDataString($rawUrl.TrimStart('/'))
            $candidate = Join-Path $Path $decoded.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            
            if (Test-Path $candidate -PathType Leaf) {
                $targetFile = $candidate
            } elseif (Test-Path ($candidate + ".html") -PathType Leaf) {
                $targetFile = $candidate + ".html"
            }
        }

        if ($targetFile -and (Test-Path $targetFile -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($targetFile).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $mime
            $bytes = [System.IO.File]::ReadAllBytes($targetFile)
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errContent = "<h1>404 Not Found - GORSY</h1><p>The requested page '$rawUrl' does not exist.</p><p><a href='/'>Return to Home</a></p>"
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errContent)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
