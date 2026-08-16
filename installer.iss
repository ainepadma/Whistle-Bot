#define MyAppName "小鹞 WhistleBot"
#define MyAppVersion "1.1.0"
#define MyAppExeName "Bootstrap.exe"
#define MyAppId "7A2E4D0F-9B1C-4A3E-8F2D-6C5B4A3E2F10"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=东南大学 声绘鹞影实践团
AppContact=Ainepadma
AppComments=开发人员：Ainepadma
DefaultDirName={localappdata}\Programs\BanyaoPet
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=DesktopPet-win-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
SetupIconFile=assets\app.ico
UninstallDisplayIcon={app}\Bootstrap.exe
UninstallDisplayName={#MyAppName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany=东南大学 声绘鹞影实践团
VersionInfoDescription=小鹞 WhistleBot

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标："; Flags: unchecked

[Files]
Source: "dist\DesktopPet-win-x64\Bootstrap.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\DesktopPet-win-x64\Pet.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\DesktopPet-win-x64\wwwroot\*"; DestDir: "{app}\wwwroot"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行小鹞 WhistleBot"; Flags: nowait postinstall skipifsilent
