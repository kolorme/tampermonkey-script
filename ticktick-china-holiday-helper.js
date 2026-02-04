// ==UserScript==
// @name         TickTick 中国节假日助手
// @name:en      TickTick China Holiday Helper
// @name:zh      TickTick 中国节假日助手
// @description  修复国际版滴答清单桌面月历视图不显示中国公历节假日的问题。自动获取当年节假日数据（含调休），点击即可复制粘贴到日历中。支持深色/浅色主题自适应、流畅动画交互
// @icon         https://d107mjio2rjf74.cloudfront.net/web/static/build/app/i/50de61d6fbc1c40dcebd835630b56f39.png
// @match        *://*.ticktick.com/*
// @author       kolorme
// @version      20260204
//
// @homepage     https://github.com/kolorme/tampermonkey-script/ticktick-china-holiday-helper.js
// @supportURL   https://github.com/kolorme/tampermonkey-script
//
// @grant        none
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 常量配置 ====================
    const CONFIG = {
        SELECTORS: {
            CONFIRM_DIALOG: 'holiday-confirm-dialog',
            CANCEL_BTN: 'holiday-cancel-btn',
            LIST_CONTAINER: 'holiday-list-container',
            HOLIDAY_LIST: 'holiday-list'
        },
        ANIMATION: {
            DURATION: 300,           // 动画持续时间(ms)
            DELAY_BUFFER: 100,       // 缓冲时间(ms)
            SLIDE_IN: 'slideInRight',
            FADE_OUT: 'fadeOutRight'
        },
        DIALOG: {
            COUNTDOWN_START: 5,      // 倒计时起始秒数
            POSITION: {
                RIGHT: '2%',
                TOP: '10%',
                TOP_LIST: '4%'
            },
            SIZE: {
                WIDTH: '280px',
                MAX_HEIGHT: 'calc(100vh - 180px)'
            }
        },
        API: {
            BASE_URL: 'https://timor.tech/api/holiday/year/',
            RETRY_DELAY: 400         // 弹窗切换延迟(ms)
        },
        STYLES: {
            ACCENT_COLOR: '#ff6b6b',
            ACCENT_HOVER: '#ff5252'
        }
    };

    // ==================== 状态管理 ====================
    // 存储所有活动的DOM元素引用，用于主题切换时更新
    const activeElements = {
        containers: new Set(),
        buttons: new Map(), // button -> { variant }
        textElements: new Map(), // element -> { type: 'title'|'desc'|'item', originalText: string }
        listItems: new Set(),
        listTitles: new Set() // 专门存储列表标题元素
    };

    let globalStylesElement = null;

    // ==================== 主题管理模块 ====================
    const ThemeManager = {
        /**
         * 检测系统当前是否处于深色模式
         * @returns {boolean}
         */
        isDarkMode() {
            return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
        },

        /**
         * 监听系统主题变化
         * @param {Function} callback - 接收布尔值(isDark)的回调
         */
        watch(callback) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e) => callback(e.matches);

            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handler);
            } else {
                mediaQuery.addListener(handler);
            }
        },

        /**
         * 获取当前主题颜色配置
         * @returns {Object}
         */
        getColors() {
            const dark = this.isDarkMode();
            return {
                bg: dark ? '#1e1e1e' : '#ffffff',
                textPrimary: dark ? '#e0e0e0' : '#333333',
                textSecondary: dark ? '#a0a0a0' : '#666666',
                border: dark ? '#444444' : '#eeeeee',
                btnCancelBg: dark ? '#3a3a3a' : '#f5f5f5',
                btnCancelText: dark ? '#e0e0e0' : '#666666',
                btnCancelHover: dark ? '#4a4a4a' : '#e0e0e0',
                itemHover: dark ? '#2a2a2a' : '#f5f5f5',
                scrollbarTrack: dark ? '#2a2a2a' : 'transparent',
                scrollbarThumb: dark ? '#555' : `linear-gradient(180deg, ${CONFIG.STYLES.ACCENT_COLOR} 0%, #ff8e8e 100%)`,
                scrollbarThumbHover: dark ? '#666' : `linear-gradient(180deg, ${CONFIG.STYLES.ACCENT_HOVER} 0%, ${CONFIG.STYLES.ACCENT_COLOR} 100%)`,
                shadowOpacity: dark ? '0.5' : '0.15'
            };
        }
    };

    // ==================== 样式管理模块 ====================
    const StyleManager = {
        /**
         * 注入CSS动画和滚动条样式
         */
        injectGlobalStyles() {
            const theme = ThemeManager.getColors();

            // 如果已存在，先移除旧的
            if (globalStylesElement && globalStylesElement.parentNode) {
                globalStylesElement.parentNode.removeChild(globalStylesElement);
            }

            const style = document.createElement('style');
            globalStylesElement = style;

            style.textContent = `
                @keyframes ${CONFIG.ANIMATION.SLIDE_IN} {
                    from { transform: translate(100%, -50%); opacity: 0; }
                    to { transform: translate(0, -50%); opacity: 1; }
                }
                @keyframes ${CONFIG.ANIMATION.FADE_OUT} {
                    from { transform: translate(0, -50%); opacity: 1; }
                    to { transform: translate(100%, -50%); opacity: 0; }
                }
                #${CONFIG.SELECTORS.LIST_CONTAINER}::-webkit-scrollbar {
                    width: 6px;
                }
                #${CONFIG.SELECTORS.LIST_CONTAINER}::-webkit-scrollbar-track {
                    background: ${theme.scrollbarTrack};
                    margin: 4px 0;
                }
                #${CONFIG.SELECTORS.LIST_CONTAINER}::-webkit-scrollbar-thumb {
                    background: ${theme.scrollbarThumb};
                    border-radius: 10px;
                    border: 1px solid ${ThemeManager.isDarkMode() ? '#444' : 'rgba(255,255,255,0.3)'};
                }
                #${CONFIG.SELECTORS.LIST_CONTAINER}::-webkit-scrollbar-thumb:hover {
                    background: ${theme.scrollbarThumbHover};
                    width: 8px;
                }
                #${CONFIG.SELECTORS.LIST_CONTAINER}::-webkit-scrollbar-corner {
                    background: transparent;
                }
                #${CONFIG.SELECTORS.LIST_CONTAINER} {
                    scrollbar-width: thin;
                    scrollbar-color: ${CONFIG.STYLES.ACCENT_COLOR} ${theme.scrollbarTrack};
                }
            `;

            document.head.appendChild(style);
            return style;
        },

        /**
         * 注入节假日列表专用动画
         */
        injectHolidayListStyles() {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInRightHoliday {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOutRightHoliday {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            return style;
        },

        /**
         * 更新所有活动元素的主题样式
         */
        updateAllThemeStyles() {
            const theme = ThemeManager.getColors();

            // 更新全局样式
            this.injectGlobalStyles();

            // 更新所有容器
            activeElements.containers.forEach(container => {
                if (document.body.contains(container)) {
                    container.style.background = theme.bg;
                    container.style.borderColor = theme.border;
                    container.style.color = theme.textPrimary;
                    container.style.boxShadow = `0 4px 20px rgba(0,0,0,${theme.shadowOpacity})`;
                } else {
                    activeElements.containers.delete(container);
                }
            });

            // 更新所有按钮
            activeElements.buttons.forEach((info, btn) => {
                if (document.body.contains(btn)) {
                    if (info.variant === 'secondary') {
                        btn.style.borderColor = theme.border;
                        btn.style.background = theme.btnCancelBg;
                        btn.style.color = theme.btnCancelText;
                        // 重新绑定hover事件
                        btn.onmouseover = () => { btn.style.background = theme.btnCancelHover; };
                        btn.onmouseout = () => { btn.style.background = theme.btnCancelBg; };
                    }
                } else {
                    activeElements.buttons.delete(btn);
                }
            });

            // 更新普通文本元素
            activeElements.textElements.forEach((info, el) => {
                if (document.body.contains(el)) {
                    if (info.type === 'title') {
                        el.style.color = theme.textPrimary;
                    } else if (info.type === 'desc') {
                        el.style.color = theme.textSecondary;
                    } else if (info.type === 'item') {
                        el.style.color = theme.textPrimary;
                    }
                } else {
                    activeElements.textElements.delete(el);
                }
            });

            // 专门更新列表标题（包括背景色）
            activeElements.listTitles.forEach(titleEl => {
                if (document.body.contains(titleEl)) {
                    titleEl.style.color = theme.textPrimary;
                    titleEl.style.background = theme.bg;
                } else {
                    activeElements.listTitles.delete(titleEl);
                }
            });

            // 更新列表项hover效果需要重新绑定事件
            activeElements.listItems.forEach(li => {
                if (document.body.contains(li)) {
                    li.onmouseover = () => { li.style.backgroundColor = theme.itemHover; };
                    li.onmouseout = () => { li.style.backgroundColor = 'transparent'; };
                } else {
                    activeElements.listItems.delete(li);
                }
            });
        }
    };

    // ==================== DOM 构建模块 ====================
    const DOMBuilder = {
        /**
         * 创建基础弹窗容器
         * @param {Object} options - 配置选项
         * @returns {HTMLElement}
         */
        createContainer(options = {}) {
            const {
                id,
                top = CONFIG.DIALOG.POSITION.TOP,
                useTransform = true,
                animation = CONFIG.ANIMATION.SLIDE_IN,
                extraStyles = {}
            } = options;

            const theme = ThemeManager.getColors();
            const container = document.createElement('div');

            if (id) container.id = id;

            const baseStyles = {
                position: 'fixed',
                right: CONFIG.DIALOG.POSITION.RIGHT,
                top: top,
                background: theme.bg,
                borderRadius: '12px',
                padding: '20px',
                width: CONFIG.DIALOG.SIZE.WIDTH,
                boxShadow: `0 4px 20px rgba(0,0,0,${theme.shadowOpacity})`,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                zIndex: '9999',
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
                animation: `${animation} ${CONFIG.ANIMATION.DURATION}ms ease-out forwards`
            };

            Object.assign(container.style, baseStyles, extraStyles);

            if (useTransform) {
                container.style.transform = 'translateY(-50%)';
            }

            // 注册到活动元素
            activeElements.containers.add(container);

            // 监听元素移除，从集合中清理
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node === container || (node.contains && node.contains(container))) {
                            activeElements.containers.delete(container);
                            observer.disconnect();
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });

            return container;
        },

        /**
         * 创建按钮
         * @param {Object} options
         * @returns {HTMLElement}
         */
        createButton(options) {
            const {
                text,
                variant = 'primary',  // 'primary' | 'secondary'
                onClick
            } = options;

            const theme = ThemeManager.getColors();
            const btn = document.createElement('button');

            const baseStyles = {
                flex: '1',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.2s'
            };

            const variants = {
                primary: {
                    border: 'none',
                    background: CONFIG.STYLES.ACCENT_COLOR,
                    color: 'white',
                    fontWeight: '500'
                },
                secondary: {
                    border: `1px solid ${theme.border}`,
                    background: theme.btnCancelBg,
                    color: theme.btnCancelText
                }
            };

            Object.assign(btn.style, baseStyles, variants[variant]);
            btn.textContent = text;

            // 悬停效果 - 使用函数以便动态更新
            const applyHoverEffects = () => {
                if (variant === 'primary') {
                    btn.onmouseover = () => { btn.style.background = CONFIG.STYLES.ACCENT_HOVER; };
                    btn.onmouseout = () => { btn.style.background = CONFIG.STYLES.ACCENT_COLOR; };
                } else {
                    const currentTheme = ThemeManager.getColors();
                    btn.onmouseover = () => { btn.style.background = currentTheme.btnCancelHover; };
                    btn.onmouseout = () => { btn.style.background = currentTheme.btnCancelBg; };
                }
            };
            applyHoverEffects();

            if (onClick) btn.onclick = onClick;

            // 注册到活动元素
            activeElements.buttons.set(btn, { variant });

            return btn;
        },

        /**
         * 创建标题元素
         * @param {string} text
         * @returns {HTMLElement}
         */
        createTitle(text) {
            const theme = ThemeManager.getColors();
            const title = document.createElement('h3');
            title.textContent = text;
            title.style.cssText = `
                margin: 0 0 10px 0;
                color: ${theme.textPrimary};
                font-size: 16px;
                font-weight: 600;
            `;

            activeElements.textElements.set(title, { type: 'title' });
            return title;
        },

        /**
         * 创建描述文本
         * @param {string} text
         * @returns {HTMLElement}
         */
        createDescription(text) {
            const theme = ThemeManager.getColors();
            const p = document.createElement('p');
            p.textContent = text;
            p.style.cssText = `
                margin: 0 0 16px 0;
                color: ${theme.textSecondary};
                font-size: 13px;
                line-height: 1.5;
            `;

            activeElements.textElements.set(p, { type: 'desc' });
            return p;
        }
    };

    // ==================== 节假日数据处理模块 ====================
    const HolidayService = {
        /**
         * 获取节假日数据
         * @param {number} year
         * @returns {Promise<Map<string, string>>} - Map<date, name>
         */
        async fetchHolidays(year) {
            const response = await fetch(`${CONFIG.API.BASE_URL}${year}`);
            const data = await response.json();
            return this.processHolidays(data.holiday);
        },

        /**
         * 处理并规范化节假日数据
         * @param {Object} holidayObjList
         * @returns {Map<string, string>}
         */
        processHolidays(holidayObjList) {
            const processed = new Map();

            Object.entries(holidayObjList).forEach(([key, item]) => {
                let name = item.name;

                // 规范化名称
                name = name.replace(/[前后]/g, '');
                if (name.length > 4) {
                    name = name.replace('节', '');
                }

                processed.set(item.date, name);
            });

            return processed;
        },

        /**
         * 排序节假日数据
         * @param {Map<string, string>} holidayMap
         * @returns {Array<[string, string]>}
         */
        sortHolidays(holidayMap) {
            return Array.from(holidayMap.entries()).sort((a, b) =>
                new Date(a[0]) - new Date(b[0])
            );
        }
    };

    // ==================== 剪贴板工具模块 ====================
    const ClipboardUtil = {
        /**
         * 复制文本到剪贴板
         * @param {string} text
         * @returns {Promise<void>}
         */
        async copy(text) {
            await navigator.clipboard.writeText(text);
        }
    };

    // ==================== UI 控制器模块 ====================
    const UIController = {
        /**
         * 关闭元素并移除
         * @param {HTMLElement} element
         * @param {string} animationName
         */
        closeElement(element, animationName = CONFIG.ANIMATION.FADE_OUT) {
            element.style.animation = `${animationName} ${CONFIG.ANIMATION.DURATION}ms ease-out forwards`;
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                // 从活动集合中移除
                activeElements.containers.delete(element);
            }, CONFIG.ANIMATION.DURATION);
        },

        /**
         * 创建确认弹窗
         */
        createConfirmDialog() {
            const theme = ThemeManager.getColors();

            // 注入全局样式
            StyleManager.injectGlobalStyles();

            // 创建容器
            const dialog = DOMBuilder.createContainer({
                id: CONFIG.SELECTORS.CONFIRM_DIALOG,
                zIndex: '9998'
            });

            // 创建内容
            const title = DOMBuilder.createTitle('📅 节假日数据');
            const content = DOMBuilder.createDescription('需要获取今年的中国节假日数据吗？');

            // 创建按钮容器
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display: flex; gap: 10px;';

            // 倒计时状态
            let countdown = CONFIG.DIALOG.COUNTDOWN_START;
            let countdownInterval;

            // 创建按钮
            const cancelBtn = DOMBuilder.createButton({
                text: `不需要 (${countdown}s)`,
                variant: 'secondary',
                onClick: () => {
                    clearInterval(countdownInterval);
                    this.closeElement(dialog);
                }
            });
            cancelBtn.id = CONFIG.SELECTORS.CANCEL_BTN;

            const confirmBtn = DOMBuilder.createButton({
                text: '需要',
                variant: 'primary',
                onClick: () => {
                    clearInterval(countdownInterval);
                    this.closeElement(dialog);
                    this.loadHolidayData();
                }
            });

            // 启动倒计时
            countdownInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    cancelBtn.textContent = `不需要 (${countdown}s)`;
                } else {
                    clearInterval(countdownInterval);
                    this.closeElement(dialog);
                }
            }, 1000);

            // 组装
            btnContainer.append(cancelBtn, confirmBtn);
            dialog.append(title, content, btnContainer);
            document.body.appendChild(dialog);
        },

        /**
         * 加载并显示节假日列表
         */
        async loadHolidayData() {
            // 等待动画完成
            await new Promise(resolve =>
                setTimeout(resolve, CONFIG.API.RETRY_DELAY)
            );

            const year = new Date().getFullYear();

            try {
                const holidays = await HolidayService.fetchHolidays(year);
                this.renderHolidayList(year, holidays);
            } catch (error) {
                alert('获取节假日数据失败，请检查网络连接或稍后重试');
            }
        },

        /**
         * 渲染节假日列表
         * @param {number} year
         * @param {Map<string, string>} holidays
         */
        renderHolidayList(year, holidays) {
            const theme = ThemeManager.getColors();
            StyleManager.injectHolidayListStyles();

            // 创建容器
            const container = DOMBuilder.createContainer({
                id: CONFIG.SELECTORS.LIST_CONTAINER,
                top: CONFIG.DIALOG.POSITION.TOP_LIST,
                useTransform: false,
                animation: 'slideInRightHoliday',
                extraStyles: {
                    maxHeight: CONFIG.DIALOG.SIZE.MAX_HEIGHT,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: '14px'
                }
            });

            // 创建标题 - 使用独立方法创建以便特殊处理
            const title = this.createListTitle(year);

            // 创建列表
            const ul = document.createElement('ul');
            ul.id = CONFIG.SELECTORS.HOLIDAY_LIST;
            ul.style.cssText = `
                margin: 0;
                padding-left: 20px;
                font-size: 14px;
                line-height: 1.8;
                color: ${theme.textSecondary};
            `;

            // 渲染列表项
            const sortedHolidays = HolidayService.sortHolidays(holidays);
            sortedHolidays.forEach(([date, name]) => {
                const li = this.createHolidayListItem(date, name, ul, container);
                ul.appendChild(li);
            });

            container.append(title, ul);
            document.body.appendChild(container);
        },

        /**
         * 创建列表专用标题（支持实时主题更新）
         * @param {number} year
         * @returns {HTMLElement}
         */
        createListTitle(year) {
            const theme = ThemeManager.getColors();
            const title = document.createElement('h3');
            title.textContent = ` 📅  ${year}年节假日列表`;

            // 设置样式，包括sticky定位需要的背景色
            title.style.cssText = `
                margin: 0 0 12px 5px;
                padding-bottom: 8px;
                top: 0;
                background: ${theme.bg};
                z-index: 10;
                color: ${theme.textPrimary};
                font-size: 16px;
                font-weight: 600;
            `;

            // 注册到专门的列表标题集合，以便主题切换时更新背景色和文字色
            activeElements.listTitles.add(title);

            // 监听元素移除
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node === title || (node.contains && node.contains(title))) {
                            activeElements.listTitles.delete(title);
                            observer.disconnect();
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });

            return title;
        },

        /**
         * 创建单个节假日列表项
         * @param {string} date
         * @param {string} name
         * @param {HTMLElement} listElement - 父列表元素
         * @param {HTMLElement} containerElement - 容器元素
         * @returns {HTMLElement}
         */
        createHolidayListItem(date, name, listElement, containerElement) {
            const theme = ThemeManager.getColors();
            const li = document.createElement('li');

            li.textContent = `${date} ${name}`;
            li.style.cssText = `
                margin-bottom: 4px;
                cursor: pointer;
                transition: all 0.2s;
                padding: 2px 4px;
                border-radius: 4px;
                color: ${theme.textPrimary};
            `;

            // 使用函数以便动态更新hover效果
            const applyHover = () => {
                const currentTheme = ThemeManager.getColors();
                li.onmouseover = () => { li.style.backgroundColor = currentTheme.itemHover; };
                li.onmouseout = () => { li.style.backgroundColor = 'transparent'; };
            };
            applyHover();

            li.onclick = async () => {
                try {
                    await ClipboardUtil.copy(li.textContent);

                    // 播放移除动画
                    li.style.cssText += `
                        transition: all 0.3s;
                        opacity: 0;
                        transform: translateX(20px);
                        height: 0;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    `;

                    setTimeout(() => {
                        li.remove();
                        activeElements.listItems.delete(li);
                        activeElements.textElements.delete(li);
                        this.checkAndCloseEmptyList(listElement, containerElement);
                    }, CONFIG.ANIMATION.DURATION);

                } catch (err) {
                    alert('复制失败，请手动复制');
                }
            };

            // 注册到活动元素
            activeElements.listItems.add(li);
            activeElements.textElements.set(li, { type: 'item' });

            return li;
        },

        /**
         * 检查列表是否为空，为空则关闭容器
         * @param {HTMLElement} listElement
         * @param {HTMLElement} containerElement
         */
        checkAndCloseEmptyList(listElement, containerElement) {
            if (listElement.children.length === 0) {
                this.closeElement(containerElement, 'fadeOutRightHoliday');
            }
        }
    };

    // ==================== 初始化入口 ====================
    function init() {
        // 监听主题变化，实时更新所有UI
        ThemeManager.watch((isDark) => {
            console.log('[TickTick Holiday] 主题切换检测到:', isDark ? '深色模式' : '浅色模式');
            StyleManager.updateAllThemeStyles();
        });

        window.addEventListener('load', () => {
            UIController.createConfirmDialog();
        });
    }

    // 启动脚本
    init();

})();