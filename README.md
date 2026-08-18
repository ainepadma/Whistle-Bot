# 小鹞 WhistleBot

> 版本标识：**WhistleBot v1.2.0**（预览版）
> 开发人员：**Ainepadma**
> 研发团队：**东南大学 声绘鹞影实践团**
> 平台：Windows 10 / 11 x64

小鹞 WhistleBot 是一款基于三维哨口模型表情组件构建的 Windows 桌面宠物。程序以“小体积、低依赖”为目标：主程序约 1.3 MB，安装包约 2.3 MB，仅依赖 .NET 9 Desktop Runtime 与 WebView2（Win10/11 基本自带）。

最新发布说明见 [RELEASE.md](RELEASE.md)。

## 功能特性

- 三维哨口模型表情动画，行为状态机覆盖出现 / 待机 / 无互动 / 互动 / 敲键盘 / 系统待机 / 消失
- 无边框置顶透明窗口，仅模型区域可交互
- 系统级空闲检测与全局键盘钩子，表情自动响应“长时间无人操作”和“用户敲键盘”
- 原生风格右键菜单：原地展开、屏幕边缘自动翻转、无滚动条、不闪烁
- 支持颜色 / 尺寸自定义、开机自启动、桌面快捷方式、隐藏、卸载
- 番茄钟专注计时：25/5、45/10、60/15 预设 + 自定义（专注 / 休息 / 长休时长与长休轮数），专注 / 短休息 / 长休息自动流转，托盘气泡提醒
- 敲键盘音符动画：每次按键从宠物顶部弹出随机音符（多种符号 / 颜色 / 动画）
- 全新哨口造型应用图标（多尺寸），托盘 / 快捷方式 / 安装器同步
- 托盘图标可随时显示 / 退出

## v1.2.0 更新亮点

- 日程深度整合：提供行动、今天、日历、管理四张桌面卡片；未固定时原位切换，固定后可并存管理
- 卡片体验优化：窗口在 WebView 内容就绪后淡入，关闭淡出；切换时目标卡先就位再替换旧卡，消除白帧、闪烁与跳位
- 日程工作流：专注番茄钟、待办、即将开始和日历互通，支持从卡片直接创建、完成和查看日程
- 视觉统一：日程控制台和卡片统一为低饱和浅色界面、柔和阴影与一致圆角；主题色实时跟随桌宠“样式 → 颜色”
- 更新检查：每次启动静默读取发布页的 `version.yml`；右键菜单“设置”中可手动检查，有新版本时跳转下载页
- 番茄钟保留 25/5、45/10、60/15 和自定义模式，并以轮次圆点展示进度
## 架构

```
Bootstrap.exe（.NET Framework 4.8，Windows 自带）
  └─ 检测 .NET 9 Desktop Runtime
       ├─ 已安装 → 直接启动 Pet.exe
       └─ 未安装 → 弹窗引导一键安装（官方 dotnet-install，免管理员）或打开下载页

Pet.exe（.NET 9 框架依赖单文件 + WebView2）
  ├─ 无边框置顶透明窗口
  ├─ GetLastInputInfo()：系统空闲检测
  ├─ WH_KEYBOARD_LL：全局键盘钩子
  ├─ 鼠标交互：拖拽移动、点击互动、右键菜单
  └─ WebView2 加载 wwwroot（HTML/SVG/JS 表情组件与菜单页面）
```

## 目录结构

```
DesktopPet/
├─ assets/                     # 应用图标（app.ico / 预览 PNG / SVG 源文件）
│  ├─ app.ico                  #   应用图标（多尺寸）
│  ├─ icon-preview.png         #   图标预览
│  └─ whistle-icon.svg         #   哨口造型 SVG 源文件
├─ src/                        # 源码
│  ├─ Bootstrap/               # 启动引导器（.NET Framework 4.8）
│  │  ├─ Bootstrap.csproj      #   工程文件
│  │  └─ Program.cs            #   入口：检测 .NET 9 运行时并引导启动 Pet.exe
│  ├─ FocusTimer.Tests/        # 番茄钟单元测试（零依赖控制台测试）
│  │  ├─ FocusTimer.Tests.csproj
│  │  └─ Program.cs
│  ├─ PetApp/                  # 桌宠主程序（.NET 9 + WebView2）
│  │  ├─ Program.cs            #   入口
│  │  ├─ MainForm.cs           #   主窗体、行为调度、菜单定位
│  │  ├─ MenuForm.cs           #   独立菜单窗口
│  │  ├─ FocusForm.cs          #   番茄钟浮层窗口
│  │  ├─ FocusTimerService.cs  #   番茄钟计时服务（墙钟计时 + JSON 持久化）
│  │  ├─ NativeInput.cs        #   空闲检测与键盘钩子
│  │  ├─ WebAssets.cs          #   wwwroot 页面 URI（缓存破坏版本号）
│  │  ├─ PetApp.csproj         #   工程文件
│  │  └─ wwwroot/              #   前端资源（HTML/SVG/JS/CSS）
│  │     ├─ index.html         #   桌宠主页面
│  │     ├─ menu.html          #   右键菜单页面
│  │     ├─ menu.js            #   菜单逻辑
│  │     ├─ focus.html         #   番茄钟浮层页面
│  │     ├─ focus.css / focus.js  # 番茄钟样式与逻辑
│  │     ├─ pet.css / pet.js   #   桌宠样式与交互
│  │     └─ original-data.js   #   表情组件模型数据
├─ build.ps1                   # 构建脚本
├─ installer.iss               # Inno Setup 安装包脚本
├─ tools/                      # 图标生成脚本 make-icon.ps1
├─ README.md                   # 本文件（仓库主页）
├─ RELEASE.md                  # 发布版说明（Release 页面）
└─ .gitignore

```

`src/**/bin`、`src/**/obj` 为编译中间文件，已加入 `.gitignore`，不纳入版本管理。

## 测试

```powershell
dotnet run --project src\FocusTimer.Tests -c Release
```

覆盖：墙钟递减、暂停 / 恢复、跳过、重置、长休息周期、预设切换、JSON 持久化与重启恢复、运行中过期的状态推进。

## 快速开始

想直接使用：下载 [RELEASE.md](RELEASE.md) 中列出的安装包或绿色版压缩包，双击 `Bootstrap.exe` 即可。

想从源码构建：

```powershell
# 环境要求：Windows 10/11 x64、.NET 9 SDK、.NET Framework 4.8 Developer Pack
.\build.ps1
```

产物输出到 `dist\DesktopPet-win-x64\`，压缩包为 `dist\DesktopPet-win-x64.zip`。

生成安装包（需 Inno Setup 6）：

```powershell
& "$env:LOCALAPPDATA\InnoSetup6\ISCC.exe" .\installer.iss
```

## 技术栈

- C# / .NET 9（主程序）、.NET Framework 4.8（引导器）
- WebView2 + HTML / SVG / JavaScript（表情与菜单界面）
- WinForms（窗口、托盘、系统钩子）
- Inno Setup（安装包）

## 致谢

表情组件基于 GrokBot 模型数据构建。

## 反馈

欢迎通过 GitHub Issues 反馈问题与建议（预览版尚在打磨阶段）。

## 发布版本信息

构建后会在 `dist\version.yml` 生成版本清单。将该文件上传到：

`https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/version.yml`

应用会在启动和手动点击“设置 → 检查更新”时读取该文件；当 `version` 高于本地版本时，引导用户前往 `#download` 下载新版本。
