$baseDir = "C:\Users\Saleem\.gemini\antigravity\scratch\stitch_gorsy_garments_3d_customizer"
$indexPath = Join-Path $baseDir "index.html"
$sectionPath = Join-Path $baseDir "customizer_section.html"
$scriptPath = Join-Path $baseDir "customizer_script.js"

$content = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$sectionText = [System.IO.File]::ReadAllText($sectionPath, [System.Text.Encoding]::UTF8)
$scriptText = [System.IO.File]::ReadAllText($scriptPath, [System.Text.Encoding]::UTF8)

# 1. Replace HTML Customizer section
$pos1 = $content.IndexOf('<!-- 6. 3D CUSTOMIZATION STUDIO')
$pos2 = $content.IndexOf('<!-- 7. DEDICATED QUALITY ASSURANCE SECTION')
if ($pos1 -lt 0 -or $pos2 -lt 0) {
    throw "Could not find HTML Customizer section markers"
}

$beforeHTML = $content.Substring(0, $pos1)
$afterHTML = $content.Substring($pos2)
$content = $beforeHTML + $sectionText + "`r`n`r`n" + $afterHTML

# 2. Replace JS Customizer section
$pos3 = $content.IndexOf('GLOBAL STATE & VARIABLES')
$startJS = $content.LastIndexOf('/*', $pos3)
$pos4 = $content.IndexOf('PRODUCT CATALOG FILTERS & QUICK VIEW')
$endJS = $content.LastIndexOf('/*', $pos4)

if ($startJS -lt 0 -or $endJS -lt 0) {
    throw "Could not find JS Customizer section markers"
}

$beforeJS = $content.Substring(0, $startJS)
$afterJS = $content.Substring($endJS)
$content = $beforeJS + $scriptText + "`r`n`r`n  " + $afterJS

# Save updated index.html
[System.IO.File]::WriteAllText($indexPath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Successfully updated $indexPath"
