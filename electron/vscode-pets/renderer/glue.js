'use strict';
/**
 * 江海小鹞（Banyao Desktop Pets）—— 渲染进程胶水代码
 * 启动宠物引擎，并接入桌面交互（点击穿透、右键菜单、主进程命令）。
 */
(function () {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme') || 'none';
    const size = params.get('size') || 'medium';
    const petType = params.get('type');
    const petColor = params.get('color');
    const mode = params.get('mode') || 'full';

    // 小窗口模式启用控制条拖拽
    document.body.classList.add('mode-' + mode);

    // 以 100ms 为周期驱动宠物状态机（与 VS Code 扩展的 tick 一致）
    setInterval(() => {
        window.dispatchEvent(
            new MessageEvent('message', { data: { command: 'tick' } }),
        );
    }, 100);

    // 主进程命令（托盘菜单等）转发给宠物引擎
    window.petDesktop.onCommand((command) => {
        if (command && command.command === 'typing-speed') {
            handleTypingSpeed(command.speed || 0);
            return;
        }
        window.dispatchEvent(
            new MessageEvent('message', { data: command }),
        );
    });

    // ── 打字联动：随机一只宠物随输入速度上升，停止输入后缓慢下降 ──
    const typingState = {
        speed: 0,
        lift: 0,
        target: 0,
        petEl: null,
        lastTypingAt: 0,
    };
    const typingIndicator = document.getElementById('typingIndicator');
    const typingSpeedText = document.getElementById('typingSpeedText');
    let typingIndicatorTimer = null;

    function handleTypingSpeed(speed) {
        typingState.speed = speed;
        if (speed > 0.3) {
            typingState.lastTypingAt = performance.now();
            if (typingIndicator) {
                typingIndicator.classList.remove('hide');
                if (typingSpeedText) {
                    typingSpeedText.textContent = speed.toFixed(1);
                }
                if (typingIndicatorTimer) {
                    clearTimeout(typingIndicatorTimer);
                }
                typingIndicatorTimer = setTimeout(() => {
                    typingIndicator.classList.add('hide');
                }, 1200);
            }
            if (!typingState.petEl) {
                const pets = (window.petApp?.allPets?.pets) || [];
                if (pets.length > 0) {
                    typingState.petEl =
                        pets[Math.floor(Math.random() * pets.length)];
                }
            }
            // 目标高度与输入速度正相关
            typingState.target = Math.min(170, 24 + speed * 34);
        }
    }

    function animateLift(now) {
        const st = typingState;
        if (
            st.petEl &&
            (!st.petEl.el || !st.petEl.el.isConnected)
        ) {
            st.petEl = null;
        }

        const idleMs = now - st.lastTypingAt;
        if (st.speed > 0.3 && idleMs < 600) {
            // 上升速度与打字速度正相关（已调慢，约原来的 1/4）
            const rate = Math.min(0.35, 0.04 + st.speed * 0.055);
            // 限制每帧最大位移（约 1.5px/帧 ≈ 90px/s），避免跳变
            const delta = Math.max(
                -1.5,
                Math.min(1.5, (st.target - st.lift) * rate),
            );
            st.lift += delta;
        } else {
            // 未输入时缓慢下降（约 18px/s）
            st.lift = Math.max(0, st.lift - 18 / 60);
            if (st.lift <= 0) {
                st.lift = 0;
                st.petEl = null;
            }
        }

        if (st.petEl) {
            const y = -Math.round(st.lift);
            const translate = `0 ${y}px`;
            st.petEl.el.style.translate = translate;
            st.petEl.collision.style.translate = translate;
            st.petEl.speech.style.translate = translate;
        }
        requestAnimationFrame(animateLift);
    }
    requestAnimationFrame(animateLift);

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

    // 启动宠物引擎（主题 kind=2 即暗色；禁用鼠标抛掷/扔球）
    if (petType && petColor) {
        petApp.petPanelApp('../media', theme, 2, petColor, size, petType, false, false);
    }
})();
