#define MyAppName "小鹞 WhistleBot"
#define MyAppVersion "1.3.0"
#define MyAppDisplayVersion "Preview v" + MyAppVersion
#define MyPackageName "DesktopPet-Preview-v" + MyAppVersion + "-win-x64"
#define MyAppExeName "Bootstrap.exe"
#define MyAppId "7A2E4D0F-9B1C-4A3E-8F2D-6C5B4A3E2F10"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppDisplayVersion}
AppPublisher=东南大学 声绘鹞影实践团
AppContact=Ainepadma
AppComments=开发人员：Ainepadma
DefaultDirName={localappdata}\Programs\BanyaoPet
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename={#MyPackageName}-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
SetupIconFile=assets\app.ico
UninstallDisplayIcon={app}\Bootstrap.exe
UninstallDisplayName={#MyAppName} {#MyAppDisplayVersion}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany=东南大学 声绘鹞影实践团
VersionInfoDescription=小鹞 WhistleBot {#MyAppDisplayVersion}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoProductTextVersion={#MyAppDisplayVersion}

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标："; Flags: unchecked

[Files]
Source: "dist\{#MyPackageName}\Bootstrap.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\{#MyPackageName}\Pet.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\{#MyPackageName}\schedule.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\{#MyPackageName}\wwwroot\*"; DestDir: "{app}\wwwroot"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\{#MyPackageName}\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\{#MyPackageName}\RELEASE.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行小鹞 WhistleBot"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  RunValue, Expected: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    Expected := ExpandConstant('{app}\Bootstrap.exe');
    if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'BanyaoPet', RunValue) then
      if (CompareText(Trim(RunValue), Expected) = 0) or
         (CompareText(Trim(RunValue), '"' + Expected + '"') = 0) then
        RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'BanyaoPet');
  end;
end;
