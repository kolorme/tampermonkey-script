// ==UserScript==
// @name         B站音量精准控制
// @name:en      bilibili-volume-control
// @name:zh      B站音量精准控制
// @description  [增强版] 将B站视频音量调节步长优化为1%，支持可视化提示与键盘快捷操作。功能包含：1.📏上下箭头键1%精准调节 2.📊居中半透明音量提示 3.🖥️智能容器适配 4.🥣音量边界保护（0-100%）
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIBAMAAABfdrOtAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAHlBMVEUAAAAQl9cQltsRltoRl9sQl9sSlNoSltsSltv////18jJPAAAACHRSTlMAIL/fn0Bgf6idWS0AAAABYktHRAnx2aXsAAAAB3RJTUUH6QMIFAs4r1LYLAAABIhJREFUeNrtm01z2jAQhg0FnKNDWsiRknaGI51A4UjStOOjk046HOlk8nF00mnhmIQQ9LMryZZsbGNb0pqBVu8FYdZ+rLU+1ithGFpaWlpaWlpaWrui/Q0w6uhT4YwSQnOraMgbhNCoaEgHQ7oFM6poAzU5JBCnYAjx1nPBjBqpyKJgCPWWWzBkE94ySUWeCoaMCWRSMETZWyW7l3WP6t4q45HPSTcZK/fEO3yBFyvVRL1tDcltDtIsKsTiUQlCbjOdou4tY4ayKKSuL0oMo+lB0Od1BmUEMJX4VUH94ryFOwqjnCT/jNS9FaLM3cK8RSidFMod1JxYG66lUG8tARiG0WCU2C1Tb7VAILwhxygzyAiCUSLDWBXOW2HKateH9BZRPYkC6i2iizgF2FtEV7EBBtpbRmiA+ciO2OSbBQoJBhh/GDMLCRwjw5gN7y1KYZ3yNy7/okXpa1VP28k6Qky9tjfUzNdYtj+4GZAOAtA8oyIQjKxOWoOBpPurskOQ0XZAnvaV1MwF6RpKMjVEQ9Ih1dNjCbV/CkFmcp2QpPDyQ2S7+kQAUpKFjLYNIj13tbYRsjZOWKcjCYhw6FbWEA3RkH8YcusUDylHMyHqkMYkatrB7/EWKKQZX4EjI/sAEvIWxSIlb8rpw0Hoy27kGfkz9AkQxH+hjub9Z/RoKKWnAmFpgseIqekdDpqYAoSnVWIn+nkwnmyTh3BGQtrpwPtlEIJ0ZSCckZSxZz/21SAlO4URUE6UIONUBqYMQ01MFjJMZ/CHT5uYLCSLwSlLeYg3dHxOPeOAV0USQoeO+9QT2MN35d3VWbOqEadM5CHNdibDb2KWQmfMpaZnLAqpiQUSjbZTPMSThgQqTVnp4tj1Sw89BxYyZruSqnxt0YwMBsqQKt+VRLYOeRXYi2SZlSEVxPL/e4hlZO/QaroeBNLll/auYaPVFRQQyIJDWhwCWhOTH7B5nVBk6wIIhDYqOvq/klINRdawlSElNsceonBpCQqh6yotHgEP/NITLGTmOccPX/BUNo5FleoQ6qbeFz9EQvMO8udDSEji6s3qshLAANlJgCyAISy6XpEDDfEjUuyjW8Z4NaAhvCouK0X3GkBA/Le6fjieA4cYpQd89/es9BxlQM3x++e8lLBHeEcCif8V0toqyPJGUFcSECnlgpQ3CJFeP9kIpCUAYVkCYbkiEFsSYolAKnJV+WqIQPBwLrGpgJ4oApGWhuwqRGa5P6RhLgiANgIZpUI2spfIhIG4qRDpLQWrctIb4HcIRnr+FVflHQ0KbGz6cnZ2doo/5394rHB9GdPtEJsMptPpA7n84PrHzc1lVlcKPZuFEc5ErFUdBSlIsf89kFcecsZeZlOhj5EkDcZIeI/nzGsjneynyGzIhyUGOcSnLM+JK+ZZpqQKg/MLJL6TP+j6r1mmdW4qGtkGQdFjlmkQCY4EIcG+KCfLMnjFt0QhZl5vBe/F4lu62XLWJIfpMM+IlSjvbw7v85h6y0H9PKaxU4/oNuc8auBqf5NhGEL/tbUkEVpaWlpaWlpaWoD6C17m5K2yQDovAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI1LTAzLTA4VDIwOjA5OjIzKzAwOjAw+eZ6UwAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNS0wMy0wOFQyMDowOToyMyswMDowMIi7wu8AAAAASUVORK5CYII=
// @match        *://*.bilibili.com/*
// @author       kolorme
// @version      20250309
//
// @homepage     https://github.com/kolorme/tampermonkey-script/bilibili-volume-control
// @supportURL   https://github.com/kolorme/tampermonkey-script
//
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // 每次音量调整的步长，0.01对应1%音量变化（范围0-1）
    const volumeStep = 0.01;
    // 获取页面中的视频元素
    const video = document.querySelector('video');

    /* 创建音量提示元素 */
    const volumeHint = document.createElement('div');
    // 样式配置：使用绝对定位实现居中显示
    volumeHint.style.position = 'absolute'; // 相对于最近的定位父元素
    volumeHint.style.left = '50%';          // 水平居中起点
    volumeHint.style.top = '50%';           // 垂直居中起点
    volumeHint.style.transform = 'translate(-50%, -50%)'; // 通过位移实现精确居中
    volumeHint.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // 半透明黑色背景
    volumeHint.style.color = 'white';       // 白色文字
    volumeHint.style.padding = '5px 10px';  // 内边距
    volumeHint.style.borderRadius = '3px';  // 圆角边框
    volumeHint.style.fontSize = '18px';      // 字体大小
    volumeHint.style.pointerEvents = 'none'; // 禁止鼠标交互
    volumeHint.style.display = 'none';       // 初始隐藏
    volumeHint.style.zIndex = '9999';        // 确保显示在最顶层

    /**
     * 确保视频容器和提示元素的正确挂载
     * 1. 检查视频元素是否存在
     * 2. 确保提示元素被添加到视频容器中
     * 3. 为视频容器创建定位上下文（如果不存在）
     */
    const ensureContainerSetup = () => {
        if (video) {
            const videoContainer = video.parentElement;
            // 检查提示元素是否已正确挂载
            if (volumeHint.parentElement !== videoContainer) {
                videoContainer.appendChild(volumeHint);
                // 检查父容器定位状态（必须非static才能正确定位）
                const containerStyle = window.getComputedStyle(videoContainer);
                if (containerStyle.position === 'static') {
                    videoContainer.style.position = 'relative'; // 创建定位上下文
                }
            }
        }
    };

    /**
     * 音量调整函数
     * @param {number} change - 音量变化值（正数增加，负数减少）
     */
    const adjustVolume = (change) => {
        if (video) {
            // 计算新音量并限制在0-1范围内
            video.volume = Math.min(1, Math.max(0, video.volume + change));
            updateVolumeHint(); // 更新音量提示显示
        }
    };

    /**
     * 更新音量提示显示
     * 1. 检查容器挂载状态
     * 2. 显示当前音量百分比
     * 3. 3秒后自动隐藏
     */
    const updateVolumeHint = () => {
        ensureContainerSetup(); // 确保元素正确挂载
        if (video) {
            const volumePercent = Math.round(video.volume * 100);
            volumeHint.textContent = `音量: ${volumePercent}%`;
            volumeHint.style.display = 'block';
            // 设置2秒后自动隐藏
            setTimeout(() => {
                volumeHint.style.display = 'none';
            }, 3000);
        }
    };

    /* 键盘事件监听 */
    document.addEventListener('keydown', function (event) {
        // 仅处理上下箭头按键
        if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
            // 根据按键方向调整音量
            adjustVolume(event.key === 'ArrowUp' ? volumeStep : -volumeStep);
            // 阻止默认行为（页面滚动）和事件冒泡
            event.preventDefault();
            event.stopPropagation();
        }
    });

    // 初始化时隐藏提示（冗余安全设置）
    volumeHint.style.display = 'none';
})();


/* 实现细节说明：
1. 容器定位策略：
   - 将提示元素挂载到视频父容器，利用相对定位实现容器内居中
   - 自动检测父容器定位状态，必要时添加relative定位

2. 音量处理逻辑：
   - 使用video标签的原生volume属性（范围0-1）
   - 通过数学计算确保音量值始终在合法范围内

3. 用户体验优化：
   - 提示信息居中显示在视频画面中央
   - 半透明背景确保不影响视频观看
   - 自动隐藏机制避免遮挡内容

4. 兼容性考虑：
   - 通过querySelector获取视频元素，可能兼容B站多版本页面结构？🤔
   - 使用通用CSS属性保证跨浏览器兼容性

注意事项：
- 依赖视频父容器的DOM结构，若B站页面结构更改可能需要调整
- 如果页面存在多个video元素（如画中画），可能需要对其他视频元素做特殊处理

*/
