'use strict';
/**
 * VSCode Pets 桌面版 —— 渲染进程胶水代码
 * 启动原版宠物引擎，并接入桌面交互（点击穿透、右键菜单、主进程命令）。
 */
(function () {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme') || 'none';
    const size = params.get('size') || 'medium';
    const petType = params.get('type') || 'clippy';
    const petColor = params.get('color') || 'black';

    // 以 100ms 为周期驱动宠物状态机（与 VS Code 扩展的 tick 一致）
    setInterval(() => {
        window.dispatchEvent(
            new MessageEvent('message', { data: { command: 'tick' } }),
        );
    }, 100);

    // 主进程命令（托盘菜单等）转发给宠物引擎
    window.petDesktop.onCommand((command) => {
        window.dispatchEvent(
            new MessageEvent('message', { data: command }),
        );
    });

    // 点击穿透：鼠标悬停在宠物/气泡上时才把窗口切换为可交互
    let lastInteractive = null;
    window.addEventListener(
        'mousemove',
        (event) => {
            const el = document.elementFromPoint(event.clientX, event.clientY);
            const interactive = !!(
                el &&
                el.closest &&
                (el.closest('.collision') ||
                    el.closest('.bubble') ||
                    el.closest('#petControlBar') ||
                    el.closest('#desktopHint'))
            );
            if (interactive !== lastInteractive) {
                lastInteractive = interactive;
                window.petDesktop.setInteractive(interactive);
            }
        },
        { passive: true },
    );

    // 右键宠物弹出管理菜单
    document.addEventListener('contextmenu', (event) => {
        if (event.target && event.target.closest('.collision')) {
            event.preventDefault();
            window.petDesktop.openMenu();
        }
    });

    // 控制条按钮
    document.getElementById('btnPetMenu')?.addEventListener('click', () => {
        window.petDesktop.openMenu();
    });
    document.getElementById('btnPetHide')?.addEventListener('click', () => {
        window.petDesktop.hideWindow();
    });
    document.getElementById('btnPetQuit')?.addEventListener('click', () => {
        window.petDesktop.quitApp();
    });

    // 提示气泡 8 秒后淡出
    const hint = document.getElementById('desktopHint');
    if (hint) {
        setTimeout(() => hint.classList.add('hide'), 8000);
    }

    // 启动宠物引擎（主题 kind=2 即暗色；启用鼠标抛掷）
    petApp.petPanelApp('../media', theme, 2, petColor, size, petType, true, false);
})();
