# 小鹞 WhistleBot

> 版本标识：**WhistleBot Preview v1.3.0**
> 开发人员：**Ainepadma**
> 研发团队：**东南大学 声绘鹞影实践团**
> 平台：Windows 10 / 11 x64

小鹞 WhistleBot 是一款基于三维哨口模型表情组件构建的 Windows 桌面宠物。程序采用框架依赖发布，需要 x64 .NET 9 Desktop Runtime 与 WebView2；启动流程会检测依赖，并在缺失时提供安装引导。

最新发布说明见 [RELEASE.md](RELEASE.md)。

## 功能特性

- 三维哨口模型表情动画，行为状态机覆盖出现 / 待机 / 无互动 / 互动 / 敲键盘 / 系统待机 / 消失
- 无边框置顶透明窗口，仅模型区域可交互
- 系统级空闲检测与全局键盘钩子，表情自动响应“长时间无人操作”和“用户敲键盘”
- 原生风格右键菜单：原地展开、屏幕边缘自动翻转、无滚动条、不闪烁
- 支持颜色 / 尺寸自定义、开机自启动、桌面快捷方式、隐藏、卸载
- 番茄钟专注计时：25/5、45/10、60/15 预设 + 自定义（专注 / 休息 / 长休时长与长休轮数），专注 / 短休息 / 长休息自动流转，托盘气泡提醒
- 敲键盘音符动画：每次按键从宠物顶部弹出随机音符（多种符号 / 颜色 / 动画）
- 双击主体触发板鹞彩蛋：各 50% 概率汇成六角板鹞或九连星板鹞，哨口、竹骨与彩绘蒙面依次显现，随风轻摆并飘出音符；约 10 秒后自动回到小鹞，右键或 Esc 可提前收回
- 首次启动显示四步使用教学，介绍桌宠交互、日程卡片、专注计时与右键设置；之后可从桌宠“设置 → 使用教学”或日程“管理 → 设置”再次打开
- 全新哨口造型应用图标（多尺寸），托盘 / 快捷方式 / 安装器同步
- 托盘图标可随时显示 / 退出

## Preview v1.3.0 更新亮点

- 新增双击六角／九连星板鹞动画，各 50% 概率触发，参考 Banyao Kites 的实际布局、面纹和风摆；播放时临时扩展透明窗口，结束后恢复用户尺寸，拖拽位置保留
- 简化复刻原模型的彩绘风筝面，采用平涂插画与轻微正交风摆；哨口沿用当前样式色，风筝面尺寸为当前小鹞主体的 1.5 倍
- 新增首次启动使用教学，并在桌宠与日程设置中提供长期保留的入口；教学主题色跟随当前小鹞配色
- 日程深度整合：提供行动、今天、日历、管理四张桌面卡片；未固定时原位切换，固定后可并存管理
- 卡片尺寸统一：今天／行动为 400 × 300，日历／管理为 960 × 680；旧布局自动迁移，折叠后的行动卡片不再保留大块空白
- 日程工作流：专注番茄钟、待办、即将开始和日历互通，支持从卡片直接创建、完成和查看日程
- 显示优化：统一标题栏、边距与细滚动条；今天列表独立滚动，管理子页移除重复返回栏，修复手动深色主题显示
- Windows 修复：改进运行时检测、卸载归属、自启动识别、DPI／多屏位置恢复、窗口显隐同步和透明区域点击
- 日程可靠性：修复重复系列管理、时区查询与 ICS 全天日程、提醒和排除日期；自定义番茄钟轮数正确恢复
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
dotnet run --project src\Schedule.Acceptance -c Release
node src\Schedule.Acceptance\pet-region.acceptance.cjs
node src\Schedule.Acceptance\kite-animation.acceptance.cjs
npm --prefix src\Motodo.Web test
npm --prefix src\Motodo.Web run typecheck
```

覆盖：墙钟递减、暂停 / 恢复、跳过、重置、长休息周期、预设切换、JSON 持久化与重启恢复、运行中过期的状态推进。

Windows 回归另外覆盖：运行时架构与版本检测、自启动及卸载归属判断、下载链接解析、多屏卡片布局、透明命中区域、重复日程管理、时区范围查询、ICS 全天日程/提醒/排除日期往返、夏令时边界，以及前端跨窗口刷新和设置同步。验收使用临时数据，不执行真实安装或卸载。

## Preview v1.3.0 Windows 修复

- 运行时检测会复用用户目录中的 x64 .NET 9；缺少 WebView2 时提供官方安装入口。
- 安装版使用系统卸载程序。绿色版的“卸载”会取消本副本的自启动并提示手动移除程序文件，不再递归删除程序所在目录；日程与设置保留。
- 重复日程的管理列表显示整个系列。编辑、删除和完成操作会明确提示作用于整个系列，已有复杂重复规则和提醒在未修改时保留。
- ICS 转换保留时区、排除日期和提前提醒，正确转换全天日程的结束日期；无法表示的时区或提醒会在写入前报告错误。
- 卡片按所在屏幕恢复位置和大小；今日列表、设置以及显示状态会同步更新。宠物窗口的命中范围跟随实际动画几何。

源码回归与后台 WebView 检查不能替代多显示器、不同缩放比例下的人工视觉验收。

### 卡片尺寸与显示

- 今天、行动统一为 400 × 300；日历、管理统一为 960 × 680（逻辑像素，随 Windows DPI 缩放，超出屏幕工作区时自动收缩）。
- 旧布局自动迁移到两档尺寸，保留位置、固定、显示与置顶状态；行动卡片内容变化时不再伸缩窗口。
- 统一 40 像素标题栏、紧凑卡片 12 像素边距与可见细滚动条；今天列表独立滚动，底部统计和新建按钮保持可见。
- 管理入口随窗口宽度切换一至三列；深色样式跟随设置选项，避免深浅背景混用。

### 双击板鹞动画

双击小鹞主体即可触发：每次开始时独立抽取，六角板鹞与九连星板鹞各 **50%**，可能连续出现同一种；动画运行时重复双击不会叠加或重新抽取。单击遵循系统双击间隔后播放原互动动作，拖动仍用于移动桌宠。播放期间专注计时正常运行；更改尺寸、隐藏、右键菜单或 Esc 会收回动画。开启系统“减少动态效果”时使用短淡入淡出、静止风筝并停止连续音符。

`wwwroot/kite-animation.js` 使用 Canvas 透明绘制、正交投影和平涂插画，复用原主体哨口轮廓与当前样式色，避免球面高光与厚重阴影。`kite-sail.svg` 根据原 1:1 模型的 `painted_sail.png` 简化复刻朱红人物圆章、祥云、蝴蝶、牡丹与竹鸟面纹。115 枚哨口的排布和矩形＋菱形结构参考本机 `Banyao Kites/blender/hexagonal_kite/build_hexagonal_kite.py`，错峰汇聚及风摆参考 `kitechant/sound/waveform-sculpture/kite-model.js`，无需网络或额外 3D 运行库。

九连星参考 `blender/nine_linked_star/build_nine_linked_star.py` 和 `model/nine-star-layout.json`：中央大星与外围八小星均由两个同边长正方形叠成，保持 24 处尖顶相接和星面间的透明孔隙；八枚哨口含下方两枚大哨。`kite-nine-sail.svg` 根据原 `nine_medallions.png` 简化复刻中央青龙金云、外围盘龙与神将圆章。两种动画共用生命周期、色彩和缩放规则；动画按独立面片映射鼠标命中区域，透明孔隙支持点击穿透。

风筝面宽高按当前小鹞主体直径的 **1.5 倍**计算，不受透明窗口扩大或呼吸动作影响；小／中／大三档均保持该比例，极小屏幕下按可用空间收缩。`PetAnimationLayout` 按样式预留音符与飘带空间，动画几何同步到原生命中区域。保存的颜色通过编码后的启动参数和页面就绪消息传递，重启后保持一致。

### 首次使用教学

第一次成功打开程序时会显示四页使用教学，涵盖拖动、单击、双击板鹞、键盘音符、日程卡片、专注计时、样式设置以及隐藏后的托盘恢复。教学支持按钮、左右方向键翻页和 Esc 关闭，主题色跟随当前小鹞样式。

教学成功显示后写入独立的一次性标记，不受颜色、尺寸配置更新影响。修订教学时会再显示一次；需要回看时，可从桌宠“设置 → 使用教学”或日程“管理 → 设置 → 打开使用教学”进入。

## 快速开始

想直接使用：下载 [RELEASE.md](RELEASE.md) 中列出的安装包并运行；或解压绿色包后双击 `Bootstrap.exe`。升级前退出旧版本。新版自动迁移卡片尺寸，保留日程、设置及卡片位置。

想从源码构建：

```powershell
# 环境要求：Windows 10/11 x64、.NET 9 SDK、.NET Framework 4.8 Developer Pack
.\build.ps1
```

产物输出到 `dist\DesktopPet-Preview-v1.3.0-win-x64\`，绿色包为 `dist\DesktopPet-Preview-v1.3.0-win-x64.zip`。构建使用独立中间目录，不自动清理旧版本；包内包含 README 和 RELEASE。

生成安装包（需 Inno Setup 6）：

```powershell
& "$env:LOCALAPPDATA\InnoSetup6\ISCC.exe" .\installer.iss
```

安装包输出为 `dist\DesktopPet-Preview-v1.3.0-win-x64-setup.exe`。

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

`https://kitechant.cn/sound/desktop-pet/version.yml`

应用会在启动和手动点击“设置 → 检查更新”时读取该文件；当 `version` 高于本地版本时，引导用户前往 `#download` 下载新版本。

本版显示名称为 `Preview v1.3.0`，清单的 `version` 保持数值 `1.3.0`，供现有客户端比较。构建命令仅生成本地产物，不会自动上传清单或发布 GitHub Release。
