$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Get-Median([double[]]$Values) {
    $sorted = @($Values | Sort-Object)
    $middle = [math]::Floor($sorted.Count / 2)
    if ($sorted.Count % 2 -eq 0) {
        return ($sorted[$middle - 1] + $sorted[$middle]) / 2
    }
    return $sorted[$middle]
}

function Get-FrameAnchor([System.Drawing.Bitmap]$Bitmap, [int]$Frame) {
    $frameWidth = [int]($Bitmap.Width / 4)
    $frameHeight = [int]($Bitmap.Height / 4)
    $cellX = ($Frame % 4) * $frameWidth
    $cellY = [math]::Floor($Frame / 4) * $frameHeight
    $minX = $frameWidth
    $minY = $frameHeight
    $maxX = -1
    $maxY = -1
    for ($y = 0; $y -lt $frameHeight; $y++) {
        for ($x = 0; $x -lt $frameWidth; $x++) {
            $pixel = $Bitmap.GetPixel($cellX + $x, $cellY + $y)
            if ($pixel.A -lt 24) { continue }
            $neonRed = $pixel.R -gt 225 -and $pixel.G -lt 95 -and $pixel.B -lt 95
            $neonYellow = $pixel.R -gt 225 -and $pixel.G -gt 175 -and $pixel.B -lt 85
            $neonGreen = $pixel.G -gt 215 -and $pixel.R -lt 135 -and $pixel.B -lt 135
            if ($neonRed -or $neonYellow -or $neonGreen) { continue }
            $minX = [math]::Min($minX, $x)
            $minY = [math]::Min($minY, $y)
            $maxX = [math]::Max($maxX, $x)
            $maxY = [math]::Max($maxY, $y)
        }
    }
    if ($maxX -lt $minX -or $maxY -lt $minY) { throw "Empty frame $Frame" }
    return [pscustomobject]@{ Center = ($minX + $maxX) / 2; Bottom = $maxY }
}

$root = Split-Path -Parent $PSScriptRoot
$pets = @('alaskan', 'shepherd', 'siamese', 'maine-coon')
foreach ($pet in $pets) {
    $path = Join-Path $root "src\assets\pets\$pet\animations\remind.png"
    $source = [System.Drawing.Bitmap]::FromFile($path)
    try {
        $anchors = @(0..15 | ForEach-Object { Get-FrameAnchor $source $_ })
        $targetCenter = Get-Median ([double[]]@($anchors.Center))
        $targetBottom = Get-Median ([double[]]@($anchors.Bottom))
        $output = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($output)
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $frameWidth = [int]($source.Width / 4)
                $frameHeight = [int]($source.Height / 4)
                for ($frame = 0; $frame -lt 16; $frame++) {
                    $cellX = ($frame % 4) * $frameWidth
                    $cellY = [math]::Floor($frame / 4) * $frameHeight
                    $offsetX = [int][math]::Round($targetCenter - $anchors[$frame].Center)
                    $offsetY = [int][math]::Round($targetBottom - $anchors[$frame].Bottom)
                    $cell = [System.Drawing.Rectangle]::new($cellX, $cellY, $frameWidth, $frameHeight)
                    $destination = [System.Drawing.Rectangle]::new($cellX + $offsetX, $cellY + $offsetY, $frameWidth, $frameHeight)
                    $graphics.SetClip($cell)
                    $graphics.DrawImage($source, $destination, $cell, [System.Drawing.GraphicsUnit]::Pixel)
                    $graphics.ResetClip()
                }
            } finally {
                $graphics.Dispose()
            }
            $temporary = "$path.aligned.png"
            $output.Save($temporary, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $output.Dispose()
        }
    } finally {
        $source.Dispose()
    }
    Move-Item -LiteralPath "$path.aligned.png" -Destination $path -Force
    Write-Output "$pet reminder frames aligned"
}
