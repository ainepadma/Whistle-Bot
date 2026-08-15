# 小鹞 WhistleBot

> 版本标识：**WhistleBot v1.0.0**（预览版）  
> 发布者：**Ainepadma**  
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
- 托盘图标可随时显示 / 退出

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
├─ src/                        # 源码
│  ├─ PetApp/                  # 桌宠主程序（.NET 9 + WebView2）
│  │  ├─ Program.cs            #   入口
│  │  ├─ MainForm.cs           #   主窗体、行为调度、菜单定位
│  │  ├─ MenuForm.cs           #   独立菜单窗口
│  │  ├─ NativeInput.cs        #   空闲检测与键盘钩子
│  │  ├─ PetApp.csproj         #   工程文件
│  │  └─ wwwroot/              #   前端资源（宠物页面 / 菜单页面）
│  └─ Bootstrap/               # 启动引导器（.NET Framework 4.8）
│     ├─ Program.cs
│     └─ Bootstrap.csproj
├─ build.ps1                   # 构建脚本
├─ installer.iss               # Inno Setup 安装包脚本
├─ README.md                   # 本文件（仓库主页）
├─ RELEASE.md                  # 发布版说明（Release 页面）
└─ .gitignore

dist/                          # 发布产物（由构建生成，不入库）
├─ DesktopPet-win-x64/         # 绿色版目录
├─ DesktopPet-win-x64.zip      # 绿色版压缩包
├─ DesktopPet-win-x64-setup.exe# 安装包
├─ Pet/                        # 主程序发布中间产物
└─ Bootstrap/                  # 引导器构建中间产物
```

`src/**/bin`、`src/**/obj` 为编译中间文件，已加入 `.gitignore`，不纳入版本管理。

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
