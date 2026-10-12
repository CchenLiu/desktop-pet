param(
  [Parameter(Mandatory = $true)]
  [string]$Source,

  [Parameter(Mandatory = $true)]
  [string]$DestinationDirectory
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$sourceImage = [System.Drawing.Bitmap]::FromFile($Source)
$quadrantWidth = [int][Math]::Floor($sourceImage.Width / 2)
$quadrantHeight = [int][Math]::Floor($sourceImage.Height / 2)
$actions = @(
  [PSCustomObject]@{ Name = "idle"; Column = 0; Row = 0; NormalizeFrameSize = $true },
  [PSCustomObject]@{ Name = "touch"; Column = 1; Row = 0; NormalizeFrameSize = $false },
  [PSCustomObject]@{ Name = "drink"; Column = 0; Row = 1; NormalizeFrameSize = $false },
  [PSCustomObject]@{ Name = "feed"; Column = 1; Row = 1; NormalizeFrameSize = $false }
)

[System.IO.Directory]::CreateDirectory($DestinationDirectory) | Out-Null

try {
  foreach ($action in $actions) {
    $quadrant = New-Object System.Drawing.Bitmap(
      $quadrantWidth,
      $quadrantHeight,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($quadrant)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $sourceRectangle = [System.Drawing.Rectangle]::new(
      $action.Column * $quadrantWidth,
      $action.Row * $quadrantHeight,
      $quadrantWidth,
      $quadrantHeight
    )
    $destinationRectangle = [System.Drawing.Rectangle]::new(0, 0, $quadrantWidth, $quadrantHeight)
    $graphics.DrawImage($sourceImage, $destinationRectangle, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()

    $temporaryPath = Join-Path $DestinationDirectory "$($action.Name).source.png"
    $destinationPath = Join-Path $DestinationDirectory "$($action.Name).png"
    $quadrant.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $quadrant.Dispose()

    if ($action.NormalizeFrameSize) {
      & "$PSScriptRoot\chroma-key.ps1" -Source $temporaryPath -Destination $destinationPath -NormalizeFrameSize -SeparatorSearchRadius 22
    } else {
      & "$PSScriptRoot\chroma-key.ps1" -Source $temporaryPath -Destination $destinationPath -SeparatorSearchRadius 22
    }
    Remove-Item -LiteralPath $temporaryPath -Force
  }
} finally {
  $sourceImage.Dispose()
}
