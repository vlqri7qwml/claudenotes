// 本文件不引用其他模块：block/panelPosition.test.ts 会去掉 import 后直接拼接源码

// ClaudeNotes：Windows 桌面版主窗口外围可拖动留白的宽度（px），
// 与 _claudenotes.scss 的 --claudenotes-frame、electron/main.js 的 CLAUDENOTES_FRAME 保持一致
export const WINDOW_FRAME_SIZE = 10;

/** 当前窗口外围留白的宽度，没有留白（非 Windows 主窗口）或全屏时为 0 */
export const getWindowFrameSize = () => {
    return document.documentElement?.classList.contains("claudenotes-frame") &&
    !document.body?.classList.contains("body--fullscreen") ? WINDOW_FRAME_SIZE : 0;
};

export const getTopBarHeight = () => {
    const toolbarHeight = document.getElementById("toolbar")?.clientHeight;
    return document.getElementById("sidebar") ? 0 :
        (toolbarHeight ? toolbarHeight + getWindowFrameSize() : document.querySelector(".layout-tab-bar").clientHeight);
};
