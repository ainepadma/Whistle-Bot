'use strict';
/**
 * VSCode Pets 桌面版 —— 预加载脚本
 *
 * 为原版 vscode-pets 面板代码提供两个桥接：
 * 1. acquireVsCodeApi() 兼容层（状态存 localStorage，消息走 DOM 事件）
 * 2. petDesktop API（点击穿透、右键菜单、主进程命令）
 */
const { ipcRenderer } = require('electron');

// ------------------------------------------------------------------
// VS Code Webview API 兼容层
// ------------------------------------------------------------------
window.acquireVsCodeApi = () => ({
    getState: () => {
        try {
            const raw = localStorage.getItem('petPanelState');
            return raw ? JSON.parse(raw) : undefined;
        } catch (_) {
            return undefined;
        }
    },
    setState: (state) => {
        try {
            localStorage.setItem('petPanelState', JSON.stringify(state));
        } catch (_) {
            /* 忽略状态写入错误 */
        }
    },
    postMessage: (message) => {
        window.dispatchEvent(new MessageEvent('message', { data: message }));
    },
});

// ------------------------------------------------------------------
// 桌面集成 API
// ------------------------------------------------------------------
window.petDesktop = {
    setInteractive: (interactive) =>
        ipcRenderer.send('pet:set-interactive', !!interactive),
    openMenu: () => ipcRenderer.send('pet:menu'),
    hideWindow: () => ipcRenderer.send('pet:hide'),
    quitApp: () => ipcRenderer.send('pet:quit'),
    onCommand: (callback) =>
        ipcRenderer.on('pet:command', (_event, payload) => callback(payload)),
};
