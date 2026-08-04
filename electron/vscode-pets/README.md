# VSCode Pets 桌面版

将 [tonybaloney/vscode-pets](https://github.com/tonybaloney/vscode-pets)
（VS Code 桌宠扩展）移植为 Windows 桌面宠物。

## 功能

- 22 种宠物：Clippy、Rocky、Zappy、Totoro、Rubber Duck、Chicken、Dog、Fox、
  Horse、Panda、Skeleton、Raccoon、Rat、Turtle、Snail、Snake、Crab、Cockatiel、
  Deno、Monkey、Morph、Mod
- 透明置顶窗口：鼠标点击穿透，悬停到宠物上自动切换为可交互
- 点击/拖动宠物扔出去，宠物会追逐小球
- 右键宠物菜单与系统托盘菜单：添加宠物、切换主题（无/森林/城堡/海滩/冬季/秋日）、
  调整大小（nano/small/medium/large）、移除全部、退出
- 状态持久化：宠物位置与类型在重启后恢复（localStorage）

## 运行

```bash
cd electron
npm start             # 启动桌宠
npm run dev           # 启动并打开 DevTools
```

本目录即应用唯一入口（`electron/package.json` 的 `main` 指向 `vscode-pets/main.js`），
启动后直接显示桌宠。

## 打开 / 隐藏 / 关闭

- 打开：运行应用即可
- 隐藏：右上角控制条 🙈，或托盘菜单
- 重新打开：`Ctrl+Alt+P` 或托盘图标
- 退出：右上角控制条 ✖️，或托盘菜单「退出」
- 菜单：右上角控制条 ⚙️，或右键宠物

## 构建宠物引擎

宠物行为引擎直接复用上游 TypeScript 源码（`../third_party/vscode-pets/src/panel/`），
用 esbuild 打包为浏览器可用 bundle：

```bash
cd electron
npm run build:pets-bundle
```

产物：`vscode-pets/media/main-bundle.js`（全局 `petApp`，原样调用
`petApp.petPanelApp()`）。

> `third_party/` 仅为本地参考目录，未随仓库提交；需要重新构建引擎时先
> `git clone https://github.com/tonybaloney/vscode-pets.git ../third_party/vscode-pets`。

## 移植结构

```
vscode-pets/
├── main.js            # 主进程：透明置顶窗口、点击穿透、托盘、右键菜单
├── preload.js         # acquireVsCodeApi() 兼容层 + petDesktop API
├── renderer/
│   ├── index.html     # 面板页面（与扩展 webview 同构）
│   └── glue.js        # tick 驱动、悬停检测、命令转发
├── media/             # 上游动画素材（GIF/背景/字体/CSS）
│   └── main-bundle.js # esbuild 打包的宠物引擎
├── icon.png           # 托盘图标
└── README.md
```

## 原版与移植的差异

| 项目 | vscode-pets 扩展 | 本移植 |
|---|---|---|
| 运行环境 | VS Code Webview | Electron 透明置顶窗口 |
| 状态存储 | `acquireVsCodeApi` | localStorage 兼容层 |
| 动画驱动 | 扩展每 100ms 发 `tick` | 渲染进程 `setInterval` |
| 交互 | 面板内点击 | 点击穿透 + 宠物悬停交互 |
| 管理入口 | 扩展命令/状态栏 | 托盘 + 右键宠物菜单 |

## License

上游 vscode-pets 为 MIT 协议。猫咪素材因作者要求未随上游仓库分发，本移植同样不含。
