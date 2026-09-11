$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dist = Join-Path $root 'dist'
$project = [xml](Get-Content -LiteralPath (Join-Path $root 'src\PetApp\PetApp.csproj') -Raw -Encoding UTF8)
$version = [string]$project.Project.PropertyGroup.Version
$packageName = "DesktopPet-Preview-v$version-win-x64"
# Build in a fresh directory; previous archives and user files are never cleaned up.
$stage = Join-Path $dist ('.build-' + [guid]::NewGuid().ToString('N'))
$petOut = Join-Path $stage 'Pet'
$bootOut = Join-Path $stage 'Bootstrap'
$webOut = Join-Path $stage 'Web'
$pkg = Join-Path $dist $packageName
$pkgStage = Join-Path $stage 'Package'

Write-Host '== Building schedule WebView UI =='
npm --prefix (Join-Path $root 'src\Motodo.Web') run build -- --outDir $webOut --emptyOutDir false
if ($LASTEXITCODE -ne 0) { throw 'Schedule web build failed' }

Write-Host '== Publishing PetApp (.NET 9 framework-dependent single-file) =='
dotnet publish (Join-Path $root 'src\PetApp') -c Release -r win-x64 --self-contained false -o $petOut
if ($LASTEXITCODE -ne 0) { throw 'PetApp publish failed' }
Copy-Item (Join-Path $root 'src\Motodo.Web\resources\icon.ico') (Join-Path $petOut 'schedule.ico') -Force

Write-Host '== Building Bootstrap (.NET Framework 4.8, preinstalled on Windows) =='
dotnet build (Join-Path $root 'src\Bootstrap') -c Release -o $bootOut
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap build failed' }

New-Item -ItemType Directory -Force -Path $pkgStage | Out-Null
Get-ChildItem -LiteralPath $petOut -File | Where-Object { $_.Extension -notin '.xml', '.pdb' } |
    Copy-Item -Destination $pkgStage -Force
$webRoot = Join-Path $pkgStage 'wwwroot'
New-Item -ItemType Directory -Force -Path $webRoot | Out-Null
Get-ChildItem -LiteralPath (Join-Path $petOut 'wwwroot') | Where-Object { $_.Name -ne 'motodo' } |
    Copy-Item -Destination $webRoot -Recurse -Force
$scheduleRoot = Join-Path $webRoot 'motodo'
New-Item -ItemType Directory -Force -Path $scheduleRoot | Out-Null
Copy-Item (Join-Path $webOut '*') $scheduleRoot -Recurse -Force
Copy-Item (Join-Path $bootOut 'Bootstrap.exe') $pkgStage -Force
Copy-Item -LiteralPath (Join-Path $root 'README.md'), (Join-Path $root 'RELEASE.md') -Destination $pkgStage -Force

$manifest = Join-Path $root 'version.yml'
Copy-Item $manifest (Join-Path $dist 'version.yml') -Force

$zip = Join-Path $dist ($packageName + '.zip')
Compress-Archive -Path (Join-Path $pkgStage '*') -DestinationPath $zip -Force

# The unpacked package is generated output. Replace only this exact, non-link
# directory after the clean archive has been created successfully.
$resolvedDist = [IO.Path]::GetFullPath($dist).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedPkg = [IO.Path]::GetFullPath($pkg)
if (!$resolvedPkg.StartsWith($resolvedDist, [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetFileName($resolvedPkg) -ne $packageName) {
    throw "Refusing to replace unexpected package directory: $resolvedPkg"
}
if (Test-Path -LiteralPath $resolvedPkg) {
    $existingPkg = Get-Item -LiteralPath $resolvedPkg -Force
    if (($existingPkg.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to replace linked package directory: $resolvedPkg"
    }
    Remove-Item -LiteralPath $resolvedPkg -Recurse -Force
}
Move-Item -LiteralPath $pkgStage -Destination $resolvedPkg

Write-Host ''
Write-Host '== Package contents =='
Get-ChildItem $pkg | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}} | Format-Table -AutoSize
Write-Host ("Total package size: {0:N2} MB" -f ((Get-ChildItem $pkg -Recurse | Measure-Object Length -Sum).Sum / 1MB))
Write-Host ("Zip: {0}  ({1:N2} MB)" -f $zip, ((Get-Item $zip).Length / 1MB))
