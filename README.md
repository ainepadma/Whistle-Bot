# 江海小鹞 · Banyao Desktop Pets

Windows 桌面宠物应用。

本项目基于 [tonybaloney/vscode-pets](https://github.com/tonybaloney/vscode-pets)
开源项目（MIT 协议）移植。

应用启动后直接放出桌宠，没有多余的页面。

## 功能

- 内置桌宠：彩绘蝴蝶风筝（原生分辨率素材）
- 全屏透明置顶窗口，鼠标点击默认穿透，悬停到宠物上才可交互
- 悬停/点击宠物会与它互动
- 系统托盘 + 宠物右键菜单：切换宠物（同时只展示一只）、切换主题
  （无/森林/城堡/海滩/冬季/秋日）、调整大小（nano/small/medium/large）、
  移除全部、退出
- 显示区域可选：全屏 / 左侧四分之一 / 右侧四分之一 / 小窗口
  （默认均位于 Windows 任务栏上方；小窗口可拖动控制条移动）
- 打字联动：打字时随机一只宠物随输入速度上升，停止输入后缓慢下降
- 宠物状态自动保存，重启后恢复

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
├── third_party/      # 本地参考：上游源码（不入库，需自行 clone）
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── README.md
```

## License

本仓库代码基于 MIT 协议（见 [LICENSE](LICENSE)）；
第三方素材许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
