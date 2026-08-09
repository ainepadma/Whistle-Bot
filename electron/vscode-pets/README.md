# 江海小鹞（Banyao Desktop Pets）

Windows 桌面宠物应用源码。

## 功能

- 内置桌宠：彩绘蝴蝶风筝（原生分辨率素材）
- 透明置顶窗口：鼠标点击穿透，悬停到宠物上自动切换为可交互
- 悬停/点击宠物会与它互动
- 右键宠物菜单与系统托盘菜单：切换宠物（同时只展示一只）、切换主题
  （无/森林/城堡/海滩/冬季/秋日）、调整大小（nano/small/medium/large）、
  移除全部、退出
- 显示区域可选：全屏 / 左侧四分之一 / 右侧四分之一 / 小窗口
  （默认均位于 Windows 任务栏上方；小窗口可拖动控制条移动）
- 打字联动：打字时随机一只宠物随输入速度上升，停止输入后缓慢下降
- 状态持久化：宠物位置与类型在重启后恢复（localStorage）

## 运行

```bash
cd electron
npm start             # 启动桌宠
npm run dev           # 启动并打开 DevTools
```

本目录即应用唯一入口（`electron/package.json` 的 `main` 指向
`vscode-pets/main.js`），启动后直接显示桌宠。

## 打开 / 隐藏 / 关闭

- 打开：运行应用即可
- 隐藏：右上角控制条 🙈，或托盘菜单
- 重新打开：`Ctrl+Alt+P` 或托盘图标
- 退出：右上角控制条 ✖️，或托盘菜单「退出」
- 菜单：右上角控制条 ⚙️，或右键宠物

## 构建宠物引擎

宠物行为引擎源码位于本地 `../third_party/`（不入库），用 esbuild 打包为
浏览器可用 bundle：

```bash
cd electron
npm run build:pets-bundle
```

产物：`vscode-pets/media/main-bundle.js`（全局 `petApp`，原样调用
`petApp.petPanelApp()`）。

## 移植结构

```
vscode-pets/
├── main.js            # 主进程：透明置顶窗口、点击穿透、托盘、右键菜单
├── preload.js         # acquireVsCodeApi() 兼容层 + petDesktop API
├── renderer/
│   ├── index.html     # 面板页面（与引擎 webview 同构）
│   └── glue.js        # tick 驱动、悬停检测、命令转发
├── media/             # 宠物动画素材（GIF/背景/字体/CSS）
│   └── main-bundle.js # esbuild 打包的宠物引擎
├── icon.png           # 托盘图标
└── README.md
```

## License

本仓库代码基于 MIT 协议；第三方素材许可见根目录
`THIRD_PARTY_NOTICES.md`。
