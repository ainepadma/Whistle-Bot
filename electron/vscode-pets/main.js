'use strict';
/**
 * 江海小鹞（Banyao Desktop Pets）—— Electron 主进程
 *
 * Windows 桌面宠物（本应用唯一入口）：
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
const { spawn } = require('child_process');

let petWindow = null;
let tray = null;
let ipcRegistered = false;
let typingHelper = null;
let typingReportTimer = null;
let lastTypingSpeed = 0;
let typingEnabled = false;

function typingLog(message) {
    try {
        const logPath = path.join(app.getPath('userData'), 'typing-status.log');
        fs.appendFileSync(
            logPath,
            `[${new Date().toISOString()}] ${message}\n`,
            'utf8',
        );
    } catch (_) {
        /* 忽略日志写入错误 */
    }
}

// ------------------------------------------------------------------
// 宠物清单（仅包含仓库中带有 GIF 素材的宠物）
// ------------------------------------------------------------------
const PET_TYPES = [
    { type: 'hudie-kite', color: 'red', label: '🦋 蝴蝶风筝' },
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

const DISPLAY_MODES = [
    { value: 'full', label: '全屏' },
    { value: 'left-quarter', label: '左侧四分之一' },
    { value: 'right-quarter', label: '右侧四分之一' },
    { value: 'small', label: '小窗口（可拖动控制条移动）' },
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
function typingHookScriptPath() {
    if (__dirname.includes('app.asar')) {
        return path.join(
            process.resourcesPath,
            'app.asar.unpacked',
            'vscode-pets',
            'hooks',
            'typing-hook.ps1',
        );
    }
    return path.join(__dirname, 'hooks', 'typing-hook.ps1');
}

function startTypingMonitor() {
    try {
        const script = typingHookScriptPath();
        typingLog('typing monitor starting, script=' + script);
        typingHelper = spawn(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-WindowStyle',
                'Hidden',
                '-File',
                script,
            ],
            { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
        );
        typingHelper.stdout.setEncoding('utf8');
        let buffer = '';
        let lastSpeedLogTime = 0;
        typingHelper.stdout.on('data', (chunk) => {
            buffer += chunk;
            let newline;
            while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (!line) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (typeof parsed.speed === 'number') {
                        lastTypingSpeed = parsed.speed;
                        const nowMs = Date.now();
                        if (parsed.speed > 0 || nowMs - lastSpeedLogTime >= 2000) {
                            typingLog('detected speed=' + parsed.speed);
                            lastSpeedLogTime = nowMs;
                        }
                    }
                } catch (_) {
                    /* 忽略无法解析的行 */
                }
            }
        });
        typingHelper.on('error', () => {
            typingEnabled = false;
            typingLog('typing helper error');
        });
        typingHelper.on('exit', () => {
            typingEnabled = false;
            typingLog('typing helper exited');
        });

        // 每 100ms 向渲染进程报告一次打字速度
        typingReportTimer = setInterval(() => {
            sendToRenderer({ command: 'typing-speed', speed: lastTypingSpeed });
        }, 100);
    } catch (_) {
        typingEnabled = false;
    }
}

function stopTypingMonitor() {
    if (typingReportTimer) {
        clearInterval(typingReportTimer);
        typingReportTimer = null;
    }
    if (typingHelper) {
        try {
            typingHelper.kill();
        } catch (_) {
            /* 忽略 */
        }
        typingHelper = null;
    }
}

function computeWindowBounds(mode) {
    const display = screen.getPrimaryDisplay();
    // 使用工作区（workArea）：默认位于 Windows 任务栏上方
    const b = display.workArea;
    switch (mode) {
        case 'left-quarter': {
            const width = Math.round(b.width / 4);
            return { x: b.x, y: b.y, width, height: b.height };
        }
        case 'right-quarter': {
            const width = Math.round(b.width / 4);
            return { x: b.x + b.width - width, y: b.y, width, height: b.height };
        }
        case 'small': {
            const width = 360;
            const height = 280;
            return {
                x: b.x + b.width - width - 24,
                y: b.y + b.height - height - 24,
                width,
                height,
            };
        }
        case 'full':
        default:
            return { x: b.x, y: b.y, width: b.width, height: b.height };
    }
}

function createVscodePetsWindow(options = {}) {
    if (petWindow && !petWindow.isDestroyed()) {
        petWindow.show();
        return petWindow;
    }

    const config = loadConfig();
    const modeArg = process.argv.find((a) => a.startsWith('--mode='));
    const displayMode = modeArg ? modeArg.split('=')[1] : config.displayMode || 'full';
    const typeArg = process.argv.find((a) => a.startsWith('--pet-type='));
    const colorArg = process.argv.find((a) => a.startsWith('--pet-color='));
    const petType = typeArg ? typeArg.split('=')[1] : config.type || 'hudie-kite';
    const petColor = colorArg ? colorArg.split('=')[1] : config.color || 'red';
    const bounds = computeWindowBounds(displayMode);
    const screenshotArg = process.argv.find((a) => a.startsWith('--screenshot'));
    const screenshotMode = !!screenshotArg;

    petWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
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
    petWindow.setMovable(displayMode === 'small');

    petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
        query: {
            theme: config.theme || 'none',
            size: config.size || 'medium',
            type: petType,
            color: petColor,
            mode: displayMode,
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
                // 多放一只宠物，便于检查渲染效果
                [petType].forEach((type) => {
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
                console.log('[banyao-desktop-pets] screenshot saved:', path.resolve(out));
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
        petWindow.setBounds(computeWindowBounds(config.displayMode || 'full'));
        petWindow.setMovable((config.displayMode || 'full') === 'small');
        petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
            query: {
                theme: config.theme || 'none',
                size: config.size || 'medium',
                type: config.type || 'hudie-kite',
                color: config.color || 'red',
                mode: config.displayMode || 'full',
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
            label: '显示区域',
            submenu: DISPLAY_MODES.map((m) => ({
                label: m.label,
                type: 'radio',
                checked: (config.displayMode || 'full') === m.value,
                click: () => applyConfig({ displayMode: m.value }),
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
    tray.setToolTip('江海小鹞 · Banyao Desktop Pets');
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
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    // 已有实例在运行，退出本实例
    app.quit();
} else {
    // 用户再次启动时，把已有实例的宠物窗口显示出来
    app.on('second-instance', () => {
        if (petWindow && !petWindow.isDestroyed()) {
            petWindow.show();
        } else {
            createVscodePetsWindow({ withTray: true });
        }
    });

    app.whenReady().then(() => {
        registerIpc();
        createVscodePetsWindow({ withTray: true });
        startTypingMonitor();

        // 全局快捷键：无论宠物是否隐藏，都能重新打开
        const ok = globalShortcut.register(
            'CommandOrControl+Alt+P',
            togglePetWindow,
        );
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
        stopTypingMonitor();
        globalShortcut.unregisterAll();
    });
}
