# 从 src-tauri/icons/128x128@2x.png (256x256) 生成 MSIX 所需的各尺寸磁贴资源。
param(
    [string]$Source = "$PSScriptRoot\..\src-tauri\icons\128x128@2x.png",
    [string]$OutDir = "$PSScriptRoot\..\msix\Assets"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) { throw "源图不存在: $Source" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$targets = @{
    "Square44x44Logo.png"   = @(44, 44)
    "Square71x71Logo.png"   = @(71, 71)
    "Square150x150Logo.png" = @(150, 150)
    "Wide310x150Logo.png"   = @(310, 150)
    "Square310x310Logo.png" = @(310, 310)
    "StoreLogo.png"         = @(50, 50)
}

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
foreach ($name in $targets.Keys) {
    $w = $targets[$name][0]; $h = $targets[$name][1]
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    $path = Join-Path $OutDir $name
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("生成 {0}  ({1}x{2})" -f $name, $w, $h)
}
$src.Dispose()
