import {isWindows} from "../protyle/util/compatibility";
import {isWindow} from "../util/functions";

// ClaudeNotes：Windows 桌面版主窗口外围一圈可拖动的留白。
// 宽度见 layout/getTopBarHeight.ts 的 WINDOW_FRAME_SIZE，样式见 _claudenotes.scss 的 html.claudenotes-frame。
// 留白由四条固定在窗口边上的 div 组成，盖在所有界面之上，所以不会被页签、菜单等占用。
export const initWindowFrame = () => {
    if (!isWindows() || isWindow() || document.documentElement.classList.contains("claudenotes-frame")) {
        return;
    }
    document.documentElement.classList.add("claudenotes-frame");
    // 放在 body 末尾：图标脚本依赖 body 第一个子元素是默认图标
    document.body.insertAdjacentHTML("beforeend", ["top", "right", "bottom", "left"].map(side =>
        `<div class="claudenotes-frame__edge claudenotes-frame__edge--${side}"></div>`).join(""));
};
