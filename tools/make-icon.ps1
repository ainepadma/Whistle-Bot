$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
New-Item -ItemType Directory -Force -Path $assets | Out-Null

# The whistle silhouette is the same path the pet renders; keep the icon true
# to the model by extracting it from MainForm.cs.
$main = Get-Content (Join-Path $root 'src\PetApp\MainForm.cs') -Raw
$match = [regex]::Match($main, 'private const string WhistlePath =\s*"([^"]+)"')
if (-not $match.Success) { throw 'WhistlePath not found in MainForm.cs' }
$pathData = $match.Groups[1].Value
$nums = [regex]::Matches($pathData, '-?\d+(?:\.\d+)?') |
    ForEach-Object { [double]$_.Value }

function New-WhistlePath {
    param([double]$Scale)
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pt = New-Object System.Drawing.PointF (($nums[0] * $Scale), ($nums[1] * $Scale))
    $gp.AddLine($pt, $pt)
    for ($i = 2; $i + 5 -lt $nums.Count; $i += 6) {
        $c1 = New-Object System.Drawing.PointF (($nums[$i] * $Scale), ($nums[$i + 1] * $Scale))
        $c2 = New-Object System.Drawing.PointF (($nums[$i + 2] * $Scale), ($nums[$i + 3] * $Scale))
        $end = New-Object System.Drawing.PointF (($nums[$i + 4] * $Scale), ($nums[$i + 5] * $Scale))
        $gp.AddBezier($pt, $c1, $c2, $end)
        $pt = $end
    }
    $gp.CloseFigure()
    return $gp
}

function ConvertTo-PngBytes {
    param([int]$Size)
    $bmp = New-Object System.Drawing.Bitmap ($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.Clear([System.Drawing.Color]::Transparent)

        $pad = [Math]::Ceiling($Size * 0.055)
        $scale = ($Size - 2 * $pad) / 212.0
        $gp = New-WhistlePath $scale
        $bounds = $gp.GetBounds()
        $m = New-Object System.Drawing.Drawing2D.Matrix
        $m.Translate((($Size - $bounds.Width) / 2) - $bounds.X,
                     (($Size - $bounds.Height) / 2) - $bounds.Y)
        $gp.Transform($m)

        $rect = $gp.GetBounds()
        $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
            $rect,
            [System.Drawing.Color]::FromArgb(255, 82, 155, 248),
            [System.Drawing.Color]::FromArgb(255, 24, 100, 214),
            90)
        $g.FillPath($brush, $gp)

        $outline = New-Object System.Drawing.Pen (
            [System.Drawing.Color]::FromArgb(160, 18, 76, 168),
            [Math]::Max(1.0, $Size / 96.0))
        $g.DrawPath($outline, $gp)

        # White eyes (viewBox coordinates, same transform as the body).
        if ($Size -ge 32) {
            $eyes = @(
                @(139.0, 72.0, 13.0),
                @(184.0, 66.0, 13.0)
            )
            $eyeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
            foreach ($e in $eyes) {
                $pts = [System.Drawing.PointF[]]@(
                    (New-Object System.Drawing.PointF ($e[0], $e[1])))
                $m.TransformPoints($pts)
                $tp = $pts[0]
                $r = [Math]::Max(1.0, $e[2] * $scale)
                $g.FillEllipse($eyeBrush, $tp.X - $r, $tp.Y - $r, $r * 2, $r * 2)
            }
            $eyeBrush.Dispose()
        }

        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        return $ms.ToArray()
    }
    finally {
        $g.Dispose()
        $bmp.Dispose()
    }
}

# Write a real multi-resolution ICO (PNG-compressed entries, 16..256).
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()
foreach ($s in $sizes) {
    $images += , @{ Size = $s; Data = ConvertTo-PngBytes $s }
    Write-Host ("{0}px -> {1} bytes" -f $s, $images[-1].Data.Length)
}

$ico = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter ($ico)
$bw.Write([uint16]0)                       # reserved
$bw.Write([uint16]1)                       # type: icon
$bw.Write([uint16]$images.Count)
$offset = 6 + 16 * $images.Count
foreach ($img in $images) {
    $w = if ($img.Size -ge 256) { 0 } else { $img.Size }
    $bw.Write([byte]$w)
    $bw.Write([byte]$w)
    $bw.Write([byte]0)                     # palette
    $bw.Write([byte]0)                     # reserved
    $bw.Write([uint16]1)                   # planes
    $bw.Write([uint16]32)                  # bpp
    $bw.Write([uint32]$img.Data.Length)
    $bw.Write([uint32]$offset)
    $offset += $img.Data.Length
}
foreach ($img in $images) {
    # PowerShell unrolls byte[] returned from functions into Object[]; cast
    # back so BinaryWriter uses the byte[] overload.
    $bw.Write([byte[]]$img.Data)
}
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $assets 'app.ico'), $ico.ToArray())
$bw.Dispose()
$ico.Dispose()

# Preview at 256 for reference.
$prev = ConvertTo-PngBytes 256
[System.IO.File]::WriteAllBytes((Join-Path $assets 'icon-preview.png'), $prev)

# SVG source for future edits.
$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#529bf8"/>
      <stop offset="1" stop-color="#1864d6"/>
    </linearGradient>
  </defs>
  <g transform="translate(22.25 22.25) scale(0.9965)">
    <path d="$pathData" fill="url(#g)" stroke="#124ca8" stroke-width="1.5"/>
    <ellipse cx="139" cy="62" rx="7" ry="7" fill="#fff"/>
    <ellipse cx="184" cy="56" rx="7" ry="7" fill="#fff"/>
  </g>
</svg>
"@
[System.IO.File]::WriteAllText((Join-Path $assets 'whistle-icon.svg'), $svg, (New-Object System.Text.UTF8Encoding $false))

Write-Host ("app.ico written: {0} x {1}" -f $sizes[0], $sizes[-1])
