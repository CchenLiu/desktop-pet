param(
    [switch]$EnforceReminder
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not ('SpriteAlignmentAudit' -as [type])) {
    Add-Type -ReferencedAssemblies ([System.Drawing.Bitmap].Assembly.Location) -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public sealed class SpriteAlignmentResult
{
    public double CenterSpread { get; set; }
    public double BottomSpread { get; set; }
    public double WidthSpread { get; set; }
    public double HeightSpread { get; set; }
}

public static class SpriteAlignmentAudit
{
    public static SpriteAlignmentResult Measure(string path)
    {
        using (var bitmap = new Bitmap(path))
        {
            var frameWidth = bitmap.Width / 4;
            var frameHeight = bitmap.Height / 4;
            var centers = new double[16];
            var bottoms = new double[16];
            var widths = new double[16];
            var heights = new double[16];

            for (var frame = 0; frame < 16; frame++)
            {
                var cellX = (frame % 4) * frameWidth;
                var cellY = (frame / 4) * frameHeight;
                var minX = frameWidth;
                var minY = frameHeight;
                var maxX = -1;
                var maxY = -1;

                for (var y = 0; y < frameHeight; y++)
                for (var x = 0; x < frameWidth; x++)
                {
                    var pixel = bitmap.GetPixel(cellX + x, cellY + y);
                    var blue = pixel.B;
                    var green = pixel.G;
                    var red = pixel.R;
                    var alpha = pixel.A;
                    if (alpha < 24) continue;
                    var neonRed = red > 225 && green < 95 && blue < 95;
                    var neonYellow = red > 225 && green > 175 && blue < 85;
                    var neonGreen = green > 215 && red < 135 && blue < 135;
                    if (neonRed || neonYellow || neonGreen) continue;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }

                if (maxX < minX || maxY < minY)
                    throw new InvalidOperationException("Empty sprite frame " + frame + " in " + path);
                centers[frame] = (minX + maxX) / 2.0;
                bottoms[frame] = maxY;
                widths[frame] = maxX - minX + 1;
                heights[frame] = maxY - minY + 1;
            }

            return new SpriteAlignmentResult {
                CenterSpread = Spread(centers),
                BottomSpread = Spread(bottoms),
                WidthSpread = Spread(widths),
                HeightSpread = Spread(heights),
            };
        }
    }

    private static double Spread(double[] values)
    {
        var min = double.MaxValue;
        var max = double.MinValue;
        foreach (var value in values) {
            min = Math.Min(min, value);
            max = Math.Max(max, value);
        }
        return max - min;
    }
}
'@
}

$root = Split-Path -Parent $PSScriptRoot
$pets = @('alaskan', 'shepherd', 'siamese', 'maine-coon')
$actions = @('idle', 'touch', 'drink', 'feed', 'run', 'remind')
$results = foreach ($pet in $pets) {
    foreach ($action in $actions) {
        $path = Join-Path $root "src\assets\pets\$pet\animations\$action.png"
        $metrics = [SpriteAlignmentAudit]::Measure($path)
        [pscustomobject]@{
            Pet = $pet
            Action = $action
            Center = [math]::Round($metrics.CenterSpread, 1)
            Bottom = [math]::Round($metrics.BottomSpread, 1)
            Width = [math]::Round($metrics.WidthSpread, 1)
            Height = [math]::Round($metrics.HeightSpread, 1)
        }
    }
}

$results | Format-Table -AutoSize

if ($EnforceReminder) {
    $failed = @($results | Where-Object {
        $_.Action -eq 'remind' -and ($_.Center -gt 6 -or $_.Bottom -gt 6 -or $_.Width -gt 24 -or $_.Height -gt 20)
    })
    if ($failed.Count -gt 0) {
        Write-Error "Reminder sprite alignment failed for: $($failed.Pet -join ', ')"
    }
}
