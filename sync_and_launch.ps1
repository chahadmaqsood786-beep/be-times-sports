$src = 'C:\Users\Saleem\.gemini\antigravity\scratch\stitch_gorsy_garments_3d_customizer\index.html'
$targets = @(
    'C:\Users\Saleem\Desktop\stitch_gorsy_garments_3d_customizer\index.html',
    'C:\Users\Saleem\Desktop\stitch_gorsy_garments_3d_customizer (1)\index.html',
    'C:\Users\Saleem\Downloads\stitch_gorsy_garments_3d_customizer (1)\index.html'
)

foreach ($t in $targets) {
    $dir = Split-Path $t
    if (Test-Path $dir) {
        Copy-Item -Path $src -Destination $t -Force
        Write-Host "Synced: $t"
    }
}

Start-Process 'C:\Users\Saleem\Desktop\stitch_gorsy_garments_3d_customizer (1)\index.html'
Write-Host "Browser launched with updated customizer."
