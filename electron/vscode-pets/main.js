'use strict';
/**
 * VSCode Pets 桌面版 —— Electron 主进程
 *
 * 将 tonybaloney/vscode-pets 的宠物引擎移植为 Windows 桌面宠物（本应用唯一入口）：
 *  - 全屏透明、无边框、置顶覆盖层
 *  - 默认鼠标点击穿透，悬停到宠物上时才可交互
 *  - 系统托盘菜单 + 宠物右键菜单
 */
const {
    app,
    BrowserWindow,
    screen,
    Tray,
    Menu,
    nativeImage,
    ipcMain,
    globalShortcut,
} = require('electron');
const path = require('path');
const fs = require('fs');

let petWindow = null;
let tray = null;
let ipcRegistered = false;

// ------------------------------------------------------------------
// 宠物清单（仅包含仓库中带有 GIF 素材的宠物）
// ------------------------------------------------------------------
const PET_TYPES = [
    { type: 'chicken', color: 'white', label: '🐔 小鸡 Chicken' },
    { type: 'clippy', color: 'black', label: '📎 Clippy' },
    { type: 'cockatiel', color: 'gray', label: '🐦 玄凤 Cockatiel' },
    { type: 'crab', color: 'red', label: '🦀 螃蟹 Crab' },
    { type: 'deno', color: 'green', label: '🦕 Deno' },
    { type: 'dog', color: 'black', label: '🐕 小狗 Dog' },
    { type: 'fox', color: 'red', label: '🦊 狐狸 Fox' },
    { type: 'horse', color: 'brown', label: '🐴 骏马 Horse' },
    { type: 'mod', color: 'purple', label: '🤖 Mod' },
    { type: 'monkey', color: 'gray', label: '🐵 猴子 Monkey' },
    { type: 'morph', color: 'purple', label: '🫠 Morph' },
    { type: 'panda', color: 'black', label: '🐼 熊猫 Panda' },
    { type: 'raccoon', color: 'gray', label: '🦝 浣熊 Raccoon' },
    { type: 'rat', color: 'gray', label: '🐀 老鼠 Rat' },
    { type: 'rocky', color: 'gray', label: '🪨 Rocky' },
    { type: 'rubber-duck', color: 'yellow', label: '🐤 橡皮鸭 Rubber Duck' },
    { type: 'skeleton', color: 'brown', label: '💀 骷髅 Skeleton' },
    { type: 'snail', color: 'brown', label: '🐌 蜗牛 Snail' },
    { type: 'snake', color: 'green', label: '🐍 蛇 Snake' },
    { type: 'totoro', color: 'gray', label: '🐭 龙猫 Totoro' },
    { type: 'turtle', color: 'green', label: '🐢 乌龟 Turtle' },
    { type: 'zappy', color: 'yellow', label: '🚀 Zappy' },
];

const THEMES = [
    { value: 'none', label: '无主题（透明桌面）' },
    { value: 'forest', label: '森林 Forest' },
    { value: 'castle', label: '城堡 Castle' },
    { value: 'beach', label: '海滩 Beach' },
    { value: 'winter', label: '冬季 Winter' },
    { value: 'autumn', label: '秋日 Autumn' },
];

const SIZES = [
    { value: 'nano', label: '迷你 Nano' },
    { value: 'small', label: '小 Small' },
    { value: 'medium', label: '中 Medium' },
    { value: 'large', label: '大 Large' },
];

// ------------------------------------------------------------------
// 配置持久化
// ------------------------------------------------------------------
function configFilePath() {
    return path.join(app.getPath('userData'), 'banyao-vscode-pets.json');
}

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configFilePath(), 'utf8'));
    } catch (_) {
        return {};
    }
}

function saveConfig(cfg) {
    try {
        fs.mkdirSync(path.dirname(configFilePath()), { recursive: true });
        fs.writeFileSync(configFilePath(), JSON.stringify(cfg, null, 2), 'utf8');
    } catch (_) {
        /* 忽略配置写入错误 */
    }
}

// ------------------------------------------------------------------
// 窗口
// ------------------------------------------------------------------
function createVscodePetsWindow(options = {}) {
    if (petWindow && !petWindow.isDestroyed()) {
        petWindow.show();
        return petWindow;
    }

    const config = loadConfig();
    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;
    const screenshotArg = process.argv.find((a) => a.startsWith('--screenshot'));
    const screenshotMode = !!screenshotArg;

    petWindow = new BrowserWindow({
        x,
        y,
        width,
        height,
        frame: false,
        transparent: !screenshotMode,
        alwaysOnTop: true,
        hasShadow: false,
        resizable: false,
        movable: false,
        skipTaskbar: true,
        focusable: false,
        enableLargerThanScreen: true,
        backgroundColor: screenshotMode ? '#151a24' : '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: false,
            nodeIntegration: false,
            sandbox: false,
            spellcheck: false,
        },
    });

    petWindow.setAlwaysOnTop(true, 'screen-saver');
    petWindow.setIgnoreMouseEvents(true, { forward: true });

    petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
        query: {
            theme: config.theme || 'none',
            size: config.size || 'medium',
            type: config.type || 'clippy',
            color: config.color || 'black',
        },
    });

    if (process.argv.includes('--dev')) {
        petWindow.webContents.once('did-finish-load', () => {
            petWindow.webContents.openDevTools({ mode: 'detach' });
        });
    }

    if (options.withTray) {
        createTray();
    }

    petWindow.on('closed', () => {
        petWindow = null;
    });

    // 截图模式：用于自动化验证渲染效果
    petWindow.webContents.once('did-finish-load', () => {
        if (!screenshotMode) return;
        const out = screenshotArg.includes('=')
            ? screenshotArg.split('=')[1]
            : path.join(__dirname, '..', '..', 'screenshot.png');

        setTimeout(() => {
            if (petWindow && !petWindow.isDestroyed()) {
                // 多放几只宠物，便于检查渲染效果
                ['rocky', 'rubber-duck', 'totoro'].forEach((type, i) => {
                    petWindow.webContents.send('pet:command', {
                        command: 'spawn-pet',
                        type,
                        color: PET_TYPES.find((p) => p.type === type).color,
                    });
                });
            }
        }, 800);

        setTimeout(async () => {
            if (petWindow && !petWindow.isDestroyed()) {
                const image = await petWindow.webContents.capturePage();
                fs.writeFileSync(path.resolve(out), image.toPNG());
                console.log('[vscode-pets] screenshot saved:', path.resolve(out));
            }
            setTimeout(() => app.quit(), 500);
        }, 4000);
    });

    return petWindow;
}

function closeVscodePetsWindow() {
    if (petWindow && !petWindow.isDestroyed()) {
        petWindow.close();
        petWindow = null;
    }
}

function showPetWindow() {
    if (petWindow && !petWindow.isDestroyed()) petWindow.show();
}

function togglePetWindow() {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (petWindow.isVisible()) {
        petWindow.hide();
    } else {
        petWindow.show();
    }
}

// ------------------------------------------------------------------
// 菜单
// ------------------------------------------------------------------
function sendToRenderer(payload) {
    if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send('pet:command', payload);
    }
}

function applyConfig(patch) {
    const config = Object.assign(loadConfig(), patch);
    saveConfig(config);
    if (petWindow && !petWindow.isDestroyed()) {
        petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
            query: {
                theme: config.theme || 'none',
                size: config.size || 'medium',
                type: config.type || 'clippy',
                color: config.color || 'black',
            },
        });
    }
    if (tray) {
        tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate()));
    }
}

function buildMenuTemplate() {
    const config = loadConfig();
    return [
        {
            label: '显示 / 隐藏宠物（Ctrl+Alt+P）',
            click: togglePetWindow,
        },
        { type: 'separator' },
        {
            label: '扔球（宠物会去追）',
            click: () => sendToRenderer({ command: 'throw-ball' }),
        },
        {
            label: '添加宠物',
            submenu: PET_TYPES.map((p) => ({
                label: p.label,
                click: () =>
                    sendToRenderer({
                        command: 'spawn-pet',
                        type: p.type,
                        color: p.color,
                    }),
            })),
        },
        {
            label: '主题',
            submenu: THEMES.map((t) => ({
                label: t.label,
                type: 'radio',
                checked: (config.theme || 'none') === t.value,
                click: () => applyConfig({ theme: t.value }),
            })),
        },
        {
            label: '宠物大小',
            submenu: SIZES.map((s) => ({
                label: s.label,
                type: 'radio',
                checked: (config.size || 'medium') === s.value,
                click: () => applyConfig({ size: s.value }),
            })),
        },
        { type: 'separator' },
        {
            label: '移除所有宠物',
            click: () => sendToRenderer({ command: 'reset-pet' }),
        },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
    ];
}

function createTray() {
    if (tray) return;
    let icon;
    try {
        icon = nativeImage
            .createFromPath(path.join(__dirname, 'icon.png'))
            .resize({ width: 16, height: 16 });
    } catch (_) {
        icon = nativeImage.createEmpty();
    }
    tray = new Tray(icon);
    tray.setToolTip('VSCode Pets 桌面版');
    tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate()));
    tray.on('click', togglePetWindow);
}

// ------------------------------------------------------------------
// IPC（幂等注册，供独立运行与主应用集成共用）
// ------------------------------------------------------------------
function registerIpc() {
    if (ipcRegistered) return;
    ipcRegistered = true;

    // 渲染进程悬停检测：宠物上方时关闭点击穿透
    ipcMain.on('pet:set-interactive', (_event, interactive) => {
        if (petWindow && !petWindow.isDestroyed()) {
            petWindow.setIgnoreMouseEvents(!interactive, { forward: true });
        }
    });

    // 宠物右键菜单
    ipcMain.on('pet:menu', () => {
        // 窗口为 focusable:false，直接以光标位置弹出菜单
        Menu.buildFromTemplate(buildMenuTemplate()).popup();
    });

    // 控制条：隐藏宠物（应用继续驻留托盘）
    ipcMain.on('pet:hide', () => {
        if (petWindow && !petWindow.isDestroyed()) {
            petWindow.hide();
        }
    });

    // 控制条：退出应用
    ipcMain.on('pet:quit', () => {
        app.quit();
    });
}

// ------------------------------------------------------------------
// 应用入口
// ------------------------------------------------------------------
app.whenReady().then(() => {
    registerIpc();
    createVscodePetsWindow({ withTray: true });

    // 全局快捷键：无论宠物是否隐藏，都能重新打开
    const ok = globalShortcut.register('CommandOrControl+Alt+P', togglePetWindow);
    if (!ok) {
        console.warn('全局快捷键 Ctrl+Alt+P 注册失败');
    }
});

// 桌宠应用常驻托盘，关闭窗口不退出
app.on('window-all-closed', () => {
    /* 保持后台运行 */
});

app.on('activate', () => {
    if (!petWindow || petWindow.isDestroyed()) {
        createVscodePetsWindow({ withTray: true });
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
