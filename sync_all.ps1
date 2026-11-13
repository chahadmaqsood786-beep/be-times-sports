$source = "C:\Users\Saleem\.gemini\antigravity\scratch\stitch_gorsy_garments_3d_customizer"
$targets = @(
    "C:\Users\Saleem\Desktop\stitch_gorsy_garments_3d_customizer",
    "C:\Users\Saleem\Desktop\stitch_gorsy_garments_3d_customizer (1)",
    "C:\Users\Saleem\Downloads\stitch_gorsy_garments_3d_customizer (1)"
)

$files = Get-ChildItem -Path $source -File | Where-Object { $_.Name -notmatch "^\." -or $_.Name -eq ".env" -or $_.Name -eq ".env.example" }

foreach ($t in $targets) {
    if (-not (Test-Path $t)) {
        New-Item -ItemType Directory -Path $t -Force | Out-Null
    }
    Write-Host "Syncing to $t ..."
    foreach ($f in $files) {
        Copy-Item -Path $f.FullName -Destination $t -Force
    }
    Write-Host "Sync completed for $t"
}

Write-Host "All directories synchronized successfully!"
