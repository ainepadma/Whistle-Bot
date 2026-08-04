# 鹞响江海 · 智绘非遗 — Electron 桌面应用

南通板鹞风筝数字化传承 Electron 桌面应用，由 Flutter 项目重构而来。

## 技术栈

- **Electron** — 跨平台桌面应用框架
- **原生 HTML/CSS/JS** — 零构建依赖，绿色运行
- **Google Fonts** — IBM Plex Sans + Syne 字体
- **Glassmorphism** — 玻璃态暗色主题

## 快速开始

```bash
# 1. 进入 electron 目录
cd electron

# 2. 安装依赖
npm install

# 3. 启动开发模式（带 DevTools）
npm run dev

# 4. 启动生产模式
npm start
```

## 构建打包

```bash
# Windows 便携版（免安装）
npm run build:win

# Windows 安装包（NSIS）
npm run build:win:installer

# macOS DMG
npm run build:mac

# Linux AppImage
npm run build:linux
```

构建产物在 `dist/` 目录下。

## 项目结构

```
electron/
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本
├── package.json     # 项目配置 & 打包配置
├── renderer/
│   ├── index.html   # 主页面（从 Flutter Widget 转换）
│   ├── styles.css   # 样式表（Glassmorphism + 暗色主题）
│   └── app.js       # 交互逻辑（滚动导航 + 展开折叠）
└── assets/          # 复用 ../assets 素材
```

## 从 Flutter 到 Electron 的迁移对照

| Flutter Widget | Web 实现 |
|---|---|
| `GlassPanel` | `.glass-panel` (backdrop-filter) |
| `_GlassNavBar` | `.glass-nav` (fixed + blur) |
| `HeroSection` | `.hero` (absolute positioning) |
| `_ArtTitle` | `.title-gold` / `.title-teal` (gradient text) |
| `SectionCard` | `.section-card` (CSS grid animation) |
| `_BackgroundGlow` | `.glow-circle` (radial-gradient + blur) |
| `InfoBar` | `.info-bar` (flexbox) |

## License

MIT © 2026 声绘鹞影实践团 · 东南大学吴健雄学院
