# 小鹞 WhistleBot v1.2.0

> 版本标识：**WhistleBot v1.2.0**
> 开发人员：**Ainepadma**
> 研发团队：**东南大学 声绘鹞影实践团**
> 发布日期：2026-08-18
> 平台：Windows 10 / 11 x64

v1.2.0 将日程从独立窗口整合为桌宠可直接操作的桌面卡片，并完成整体视觉、卡片切换与更新检查体验。

## 下载

| 文件 | 说明 |
|---|---|
| `DesktopPet-win-x64-setup.exe` | 安装包（推荐，包含启动引导器） |
| `DesktopPet-win-x64.zip` | 绿色版压缩包，解压后运行 `Bootstrap.exe` |

## 本次更新

- 新增行动、今天、日历、管理四张日程卡片；未固定时原位切换，固定后可并存于桌面
- 优化卡片生命周期：内容准备完成后淡入，关闭淡出；切换保留位置，避免闪烁、白帧和瞬移
- 整合专注、待办和即将开始：番茄钟可关联日程，完成待办与查看详情无需离开卡片
- 恢复番茄钟预设模式和轮次圆点，保留自定义专注、短休、长休与轮数
- 统一日程控制台和卡片的色调、圆角、边框、阴影；主题色即时跟随桌宠“样式 → 颜色”
- 右键“设置”新增“检查更新”；启动自动检查 `version.yml`，发现更新后提示打开下载页
- 移除右键菜单中旧的“日程”入口，避免重复功能入口

## 更新部署

将随构建输出的 `dist/version.yml` 上传到：

`https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/version.yml`

清单内的 `version` 和 `download_url` 是客户端检查更新的唯一来源。下载页固定为：

`https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/#download`

## 系统要求

- Windows 10 / 11 64 位
- .NET 9 Desktop Runtime（首次运行由 Bootstrap 引导安装）
- WebView2 运行时（Windows 10/11 一般已内置）

## 已知限制

- 检查更新需要能访问发布站点；网络不可用时启动不会打扰用户，手动检查会提示连接失败。
- 更新检查只引导下载，不会在后台替换正在运行的程序。