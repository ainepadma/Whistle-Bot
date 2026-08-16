$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dist = Join-Path $root 'dist'
$petOut = Join-Path $dist 'Pet'
$bootOut = Join-Path $dist 'Bootstrap'
$pkg = Join-Path $dist 'DesktopPet-win-x64'

Remove-Item $petOut, $bootOut, $pkg -Recurse -Force -ErrorAction SilentlyContinue

Write-Host '== Publishing PetApp (.NET 9 framework-dependent single-file) =='
dotnet publish (Join-Path $root 'src\PetApp') -c Release -r win-x64 --self-contained false -o $petOut
if ($LASTEXITCODE -ne 0) { throw 'PetApp publish failed' }

Write-Host '== Building Bootstrap (.NET Framework 4.8, preinstalled on Windows) =='
dotnet build (Join-Path $root 'src\Bootstrap') -c Release -o $bootOut
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap build failed' }

New-Item -ItemType Directory -Force -Path $pkg | Out-Null
Copy-Item (Join-Path $petOut '*') $pkg -Recurse -Force
Copy-Item (Join-Path $bootOut 'Bootstrap.exe') $pkg -Force
# drop intellisense docs / debug symbols to keep the package tiny
Get-ChildItem $pkg -Recurse -Include *.xml, *.pdb | Remove-Item -Force

$zip = Join-Path $dist 'DesktopPet-win-x64.zip'
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $pkg '*') -DestinationPath $zip -Force

Write-Host ''
Write-Host '== Package contents =='
Get-ChildItem $pkg | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}} | Format-Table -AutoSize
Write-Host ("Total package size: {0:N2} MB" -f ((Get-ChildItem $pkg -Recurse | Measure-Object Length -Sum).Sum / 1MB))
Write-Host ("Zip: {0}  ({1:N2} MB)" -f $zip, ((Get-Item $zip).Length / 1MB))
