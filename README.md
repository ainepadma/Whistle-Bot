# 小鹞 WhistleBot 预览版 v1.0.0

> 版本标识：**WhistleBot v1.0.0**  
> 发布者：**Ainepadma**  
> 研发团队：**东南大学 声绘鹞影实践团**  
> 平台：仅支持 Windows 10 / 11 x64  
> 版本日期：2026-08-15

小鹞 WhistleBot 是一款基于三维哨口模型表情组件构建的 Windows 桌面宠物。程序追求最小安装包与源码体积，采用「Bootstrap 引导器 + 单文件主程序 + WebView2 前端」架构。

## 目录结构与文件分类

```
DesktopPet/
├─ src/                        # 源码（需编译）
│  ├─ PetApp/                  # 桌宠主程序源码（.NET 9 + WebView2）
│  │  ├─ Program.cs            #   程序入口
│  │  ├─ MainForm.cs           #   主窗体：透明置顶窗口、行为调度、右键菜单定位
│  │  ├─ MenuForm.cs           #   独立菜单窗口（网页菜单承载）
│  │  ├─ NativeInput.cs        #   系统空闲检测与全局键盘钩子
│  │  ├─ PetApp.csproj         #   工程文件
│  │  └─ wwwroot/              #   前端资源（表情组件、菜单页面）
│  │     ├─ index.html         #     宠物页面
│  │     ├─ pet.js             #     表情行为状态机与交互
│  │     ├─ pet.css            #     宠物与菜单样式
│  │     ├─ original-data.js   #     表情模型数据
│  │     ├─ menu.html          #     右键菜单页面
│  │     └─ menu.js            #     菜单交互与自适应尺寸
│  └─ Bootstrap/               # 启动引导器源码（.NET Framework 4.8）
│     ├─ Program.cs            #   检测/安装 .NET 9 运行时并启动 Pet.exe
│     └─ Bootstrap.csproj      #   工程文件
├─ build.ps1                   # 构建脚本（生成 dist\ 下全部产物）
├─ installer.iss               # Inno Setup 安装包脚本
├─ .gitignore                  # 版本控制忽略规则
└─ README.md                   # 本文档

dist/                          # 发布文件（由构建生成，无需进入源码）
├─ DesktopPet-win-x64/         # 绿色版：解压即用
├─ DesktopPet-win-x64.zip      # 绿色版压缩包
├─ DesktopPet-win-x64-setup.exe# 安装包（最终交付物）
├─ Pet/                        # PetApp 发布中间产物
└─ Bootstrap/                  # Bootstrap 构建中间产物
```

**源码**：`src/` 下所有 `.cs`、`.csproj`、`wwwroot/` 前端文件，以及 `build.ps1`、`installer.iss`、`README.md`、`.gitignore`。

**发布文件**：`dist/` 下所有内容。最终交付只需 `DesktopPet-win-x64-setup.exe`，或绿色版 `DesktopPet-win-x64.zip`（解压后双击 `Bootstrap.exe`）。

**自动生成、不纳入源码**：`src/**/bin`、`src/**/obj`（编译中间文件，已由 `.gitignore` 忽略），以及 `dist/`（构建产物）。

## 架构

```
Bootstrap.exe（~8 KB，.NET Framework 4.8，Windows 自带）
  └─ 检测 .NET 9 Desktop Runtime
       ├─ 已安装 → 直接启动 Pet.exe
       └─ 未安装 → 弹窗引导：一键安装（官方 dotnet-install，免管理员）或打开下载页

Pet.exe（~1.2 MB，.NET 9 框架依赖单文件 + WebView2）
  ├─ 无边框置顶透明窗口，仅模型区域可交互
  ├─ GetLastInputInfo()：系统级空闲检测（电脑长时间待机）
  ├─ WH_KEYBOARD_LL：全局键盘钩子（敲键盘检测）
  ├─ 窗口内鼠标事件（互动、拖拽、右键菜单）
  └─ WebView2 加载 wwwroot（HTML/SVG/JS 表情组件）
       └─ 行为状态机：出现 / 待机 / 无互动 / 互动 / 敲键盘 / 系统待机 / 消失
```

## 行为场景与表情分组

| 场景 | 触发条件 | 表情池 |
|---|---|---|
| 出现 | 启动 | spawning / waking / excited |
| 待机 | 默认 | idle / listening / humming / loading / orbit / radar / progress |
| 无互动 | 2 分钟没碰宠物 | bored / confused / shy / sad / suspicious |
| 互动 | 鼠标进入 / 点击 | happy / curious / playful / laughing / proud / celebrate / bouncing / surprised / scared |
| 敲键盘 | 全局键盘输入 | thinking / searching / working / writing / dictating / receiving / sending / uploading / notifying / alerting / dragging |
| 系统待机 | 系统空闲 > 5 分钟 | sleeping / drowsy |
| 消失 | 点击关闭 | powering-down / sleeping → 动画后退出 |

## 构建

环境要求：

- Windows 10/11 x64
- .NET 9 SDK（编译 PetApp）
- .NET Framework 4.8 Developer Pack（编译 Bootstrap，通常随 VS 或 SDK 自带）
- 打包安装包还需 Inno Setup 6（本机路径示例：`%LOCALAPPDATA%\InnoSetup6\ISCC.exe`）

生成绿色版产物：

```powershell
.\build.ps1
```

产物输出到 `dist\`：

- `DesktopPet-win-x64\Bootstrap.exe` — 双击入口（自动检测 / 引导安装 .NET 9 运行时）
- `DesktopPet-win-x64\Pet.exe` — 桌宠主程序
- `DesktopPet-win-x64\wwwroot\` — 前端资源
- `DesktopPet-win-x64.zip` — 上述内容的压缩包

生成安装包：

```powershell
& "$env:LOCALAPPDATA\InnoSetup6\ISCC.exe" .\installer.iss
```

产物：`dist\DesktopPet-win-x64-setup.exe`

## 运行

- 安装包：运行 `DesktopPet-win-x64-setup.exe`，按向导安装后自动启动。
- 绿色版：解压 `DesktopPet-win-x64.zip`，双击 `Bootstrap.exe`（首次若缺 .NET 9 运行时，会提示一键安装）。
- 拖动宠物可移动；左键点击互动；右键打开菜单（样式 / 设置 / 隐藏 / 退出）；托盘图标可显示 / 退出。

## 体积与依赖

- Pet.exe + wwwroot ≈ 1.3 MB（框架依赖单文件）
- Bootstrap.exe ≈ 8 KB
- 安装包 ≈ 2.3 MB
- 目标机器需：.NET 9 Desktop Runtime（引导器可自动安装）+ WebView2（Win10/11 基本自带）
