# VSCode Pets 桌面版（Banyao Desktop Pets）

将 [tonybaloney/vscode-pets](https://github.com/tonybaloney/vscode-pets)
（VS Code 桌宠扩展）移植为 Windows 桌面宠物应用。

应用启动后直接放出桌宠，没有多余的页面。

## 功能

- 22 种宠物：Clippy、Rocky、Zappy、Totoro、橡皮鸭、小鸡、小狗、狐狸、骏马、
  熊猫、骷髅、浣熊、老鼠、乌龟、蜗牛、蛇、螃蟹、玄凤鹦鹉、Deno、猴子、Morph、Mod
- 全屏透明置顶窗口，鼠标点击默认穿透，悬停到宠物上才可交互
- 点击/拖动宠物可将其扔出去，宠物会追逐小球
- 系统托盘 + 宠物右键菜单：添加宠物、切换主题（无/森林/城堡/海滩/冬季/秋日）、
  调整大小（nano/small/medium/large）、移除全部、退出
- 宠物状态自动保存，重启后恢复

> 因上游作者要求，猫咪素材未随仓库分发，故本应用不含猫。

## 打开 / 隐藏 / 关闭

- **打开**：从本仓库 [Releases](../../releases) 下载便携版或安装版并运行；
  以后每次开机手动启动
- **隐藏**：点击屏幕右上角控制条的 🙈 按钮，或托盘菜单「显示 / 隐藏宠物」
- **重新打开**：按 `Ctrl+Alt+P`，或点击任务栏通知区的托盘图标
- **退出**：点击右上角 ✖️ 按钮，或托盘菜单「退出」
- **管理宠物**：点击右上角 ⚙️ 按钮，或右键宠物

> 托盘图标在 Windows 里可能被收进通知区的「^」隐藏区域，点开箭头后把图标拖到外面，
> 以后就能一直看到；隐藏宠物后应用仍驻留托盘，不会真正关闭。

## 快速开始

```bash
cd electron
npm install
npm start        # 启动桌宠
npm run dev      # 启动并打开 DevTools
```

## 构建

```bash
npm run build:win           # Windows 便携版
npm run build:win:installer # Windows 安装包
```

构建产物位于 `electron/dist/`，并同步复制到本地根目录 `release/`（不入库，
发布时作为 GitHub Release 附件上传）。

## 目录

```
├── electron/
│   ├── vscode-pets/  # 桌宠应用源码（主进程、渲染页、宠物素材）
│   ├── build/        # 应用图标
│   └── package.json
├── release/          # 本地构建产物（不入库，见 GitHub Releases）
├── third_party/      # 本地参考：vscode-pets 上游源码（不入库，需自行 clone）
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── README.md
```

## License

本仓库代码基于 MIT 协议（见 [LICENSE](LICENSE)）；
上游 vscode-pets 为 MIT 协议，第三方素材许可见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
