param(
  [Parameter(Mandatory = $true)]
  [string]$Source,

  [Parameter(Mandatory = $true)]
  [string]$Destination,

  [switch]$NormalizeFrameSize
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$sourceImage = [System.Drawing.Bitmap]::FromFile($Source)
$outputWidth = $sourceImage.Width - ($sourceImage.Width % 4)
$outputHeight = $sourceImage.Height - ($sourceImage.Height % 4)
$bitmap = New-Object System.Drawing.Bitmap(
  $outputWidth,
  $outputHeight,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.DrawImage($sourceImage, 0, 0, $outputWidth, $outputHeight)
$graphics.Dispose()
$sourceImage.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $bitmap.Width, $bitmap.Height)
$data = $bitmap.LockBits(
  $rect,
  [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$bytes = [Math]::Abs($data.Stride) * $bitmap.Height
$pixels = New-Object byte[] $bytes
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $bytes)

for ($y = 0; $y -lt $bitmap.Height; $y++) {
  $row = $y * $data.Stride
  for ($x = 0; $x -lt $bitmap.Width; $x++) {
    $index = $row + ($x * 4)
    $blue = [double]$pixels[$index]
    $green = [double]$pixels[$index + 1]
    $red = [double]$pixels[$index + 2]

    $otherMaximum = [Math]::Max($red, $blue)
    $greenDominance = $green - $otherMaximum
    $keyStrength = [Math]::Max(0.0, [Math]::Min(1.0, ($greenDominance - 5.0) / 40.0))
    $alpha = 255.0 * (1.0 - $keyStrength)

    if ($greenDominance -gt 4.0) {
      $pixels[$index + 1] = [byte]$otherMaximum
    }
    $pixels[$index + 3] = [byte][Math]::Round($alpha)
  }
}

$searchRadius = 56
$rowSeparators = @()
for ($separatorIndex = 1; $separatorIndex -lt 4; $separatorIndex++) {
  $ideal = [int][Math]::Round(($bitmap.Height * $separatorIndex) / 4.0)
  $bestPosition = $ideal
  $bestCount = [int]::MaxValue
  for ($candidate = $ideal - $searchRadius; $candidate -le $ideal + $searchRadius; $candidate++) {
    $count = 0
    $rowOffset = $candidate * $data.Stride
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      if ($pixels[$rowOffset + ($x * 4) + 3] -gt 8) { $count++ }
    }
    if ($count -lt $bestCount -or ($count -eq $bestCount -and [Math]::Abs($candidate - $ideal) -lt [Math]::Abs($bestPosition - $ideal))) {
      $bestCount = $count
      $bestPosition = $candidate
    }
  }
  $rowSeparators += $bestPosition
}

$rowBounds = @(0) + $rowSeparators + @($bitmap.Height)
$columnBoundsByRow = @()
for ($rowIndex = 0; $rowIndex -lt 4; $rowIndex++) {
  $columnSeparators = @()
  for ($separatorIndex = 1; $separatorIndex -lt 4; $separatorIndex++) {
    $ideal = [int][Math]::Round(($bitmap.Width * $separatorIndex) / 4.0)
    $bestPosition = $ideal
    $bestCount = [int]::MaxValue
    for ($candidate = $ideal - $searchRadius; $candidate -le $ideal + $searchRadius; $candidate++) {
      $count = 0
      for ($y = $rowBounds[$rowIndex]; $y -lt $rowBounds[$rowIndex + 1]; $y++) {
        if ($pixels[($y * $data.Stride) + ($candidate * 4) + 3] -gt 8) { $count++ }
      }
      if ($count -lt $bestCount -or ($count -eq $bestCount -and [Math]::Abs($candidate - $ideal) -lt [Math]::Abs($bestPosition - $ideal))) {
        $bestCount = $count
        $bestPosition = $candidate
      }
    }
    $columnSeparators += $bestPosition
  }
  $columnBoundsByRow += [PSCustomObject]@{
    Values = @(0) + $columnSeparators + @($bitmap.Width)
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($pixels, 0, $data.Scan0, $bytes)
$bitmap.UnlockBits($data)

$normalized = New-Object System.Drawing.Bitmap(
  $outputWidth,
  $outputHeight,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$normalizedGraphics = [System.Drawing.Graphics]::FromImage($normalized)
$normalizedGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$normalizedGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$normalizedGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$normalizedGraphics.Clear([System.Drawing.Color]::Transparent)
$cellWidth = [int]($outputWidth / 4)
$cellHeight = [int]($outputHeight / 4)
$cellPadding = 5
$frameBounds = @()
$maxFrameWidth = 0
$maxFrameHeight = 0
for ($rowIndex = 0; $rowIndex -lt 4; $rowIndex++) {
  $columnBounds = $columnBoundsByRow[$rowIndex].Values
  for ($columnIndex = 0; $columnIndex -lt 4; $columnIndex++) {
    $left = [int]$columnBounds[$columnIndex]
    $top = [int]$rowBounds[$rowIndex]
    $right = [int]$columnBounds[$columnIndex + 1]
    $bottom = [int]$rowBounds[$rowIndex + 1]
    $minX = $right
    $minY = $bottom
    $maxX = $left
    $maxY = $top
    for ($scanY = $top; $scanY -lt $bottom; $scanY++) {
      for ($scanX = $left; $scanX -lt $right; $scanX++) {
        if ($pixels[($scanY * $data.Stride) + ($scanX * 4) + 3] -gt 8) {
          if ($scanX -lt $minX) { $minX = $scanX }
          if ($scanX -gt $maxX) { $maxX = $scanX }
          if ($scanY -lt $minY) { $minY = $scanY }
          if ($scanY -gt $maxY) { $maxY = $scanY }
        }
      }
    }
    $frameWidth = [Math]::Max(1, $maxX - $minX + 1)
    $frameHeight = [Math]::Max(1, $maxY - $minY + 1)
    $maxFrameWidth = [Math]::Max($maxFrameWidth, $frameWidth)
    $maxFrameHeight = [Math]::Max($maxFrameHeight, $frameHeight)
    $frameBounds += [PSCustomObject]@{ X = $minX; Y = $minY; Width = $frameWidth; Height = $frameHeight }
  }
}

$uniformScale = [Math]::Min(
  ($cellWidth - ($cellPadding * 2)) / $maxFrameWidth,
  ($cellHeight - ($cellPadding * 2)) / $maxFrameHeight
)
for ($frameIndex = 0; $frameIndex -lt 16; $frameIndex++) {
    $rowIndex = [int][Math]::Floor($frameIndex / 4)
    $columnIndex = $frameIndex % 4
    $frame = $frameBounds[$frameIndex]
    $frameScale = if ($NormalizeFrameSize) {
      [Math]::Min(
        ($cellWidth - ($cellPadding * 2)) / $frame.Width,
        ($cellHeight - ($cellPadding * 2)) / $frame.Height
      )
    } else {
      $uniformScale
    }
    $drawWidth = [int][Math]::Round($frame.Width * $frameScale)
    $drawHeight = [int][Math]::Round($frame.Height * $frameScale)
    $sourceRect = [System.Drawing.Rectangle]::new([int]$frame.X, [int]$frame.Y, [int]$frame.Width, [int]$frame.Height)
    $destinationRect = [System.Drawing.Rectangle]::new(
      [int](($columnIndex * $cellWidth) + (($cellWidth - $drawWidth) / 2)),
      [int](($rowIndex * $cellHeight) + $cellHeight - $cellPadding - $drawHeight),
      $drawWidth,
      $drawHeight
    )
    $normalizedGraphics.DrawImage(
      $bitmap,
      $destinationRect,
      $sourceRect,
      [System.Drawing.GraphicsUnit]::Pixel
    )
}
$normalizedGraphics.Dispose()
$bitmap.Dispose()

$destinationDirectory = Split-Path -Parent $Destination
if ($destinationDirectory) {
  [System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
}
$normalized.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
$normalized.Dispose()
