import {MenuItem} from "../menus/Menu";
import {escapeHtml} from "../util/escape";
import {getInputFontSize, loadInputFontSize, saveInputFontSize} from "./inputFontSize";
import {INPUT_FONT_SIZE_MAX, INPUT_FONT_SIZE_MIN} from "./inputFontSizeCore";

// 顶栏菜单名，用于再次点击按钮时关闭面板
const MENU_NAME = "barInputFontSize";

const getValueLabel = () => {
    const fontSize = getInputFontSize();
    return fontSize ? fontSize + " px" :
        window.siyuan.languages.inputFontSizeFollow + " (" + window.siyuan.config.editor.fontSize + " px)";
};

const refreshPanel = (element: HTMLElement) => {
    const fontSize = getInputFontSize() || window.siyuan.config.editor.fontSize;
    element.querySelector("[data-value]").textContent = getValueLabel();
    element.querySelector<HTMLButtonElement>('[data-action="decrease"]').disabled = fontSize <= INPUT_FONT_SIZE_MIN;
    element.querySelector<HTMLButtonElement>('[data-action="increase"]').disabled = fontSize >= INPUT_FONT_SIZE_MAX;
    element.querySelector<HTMLButtonElement>('[data-action="follow"]').disabled = !getInputFontSize();
};

/** 顶栏「新输入字号」面板：调整之后新写的段落和粘贴内容的字号，已有文字不变 */
export const openInputFontSizeMenu = async (target: HTMLElement) => {
    const menu = window.siyuan.menus.menu;
    if (!menu.element.classList.contains("fn__none") && menu.element.getAttribute("data-name") === MENU_NAME) {
        menu.remove();
        return;
    }
    menu.remove();
    menu.element.setAttribute("data-name", MENU_NAME);
    await loadInputFontSize();
    const languages = window.siyuan.languages;
    menu.append(new MenuItem({
        iconHTML: "",
        type: "empty",
        label: `<div class="b3-menu__filter claudenotes-input-font">
    <div class="b3-menu__label">${escapeHtml(languages.inputFontSize)}</div>
    <div class="fn__hr"></div>
    <div class="fn__flex">
        <button class="b3-button b3-button--outline" data-action="decrease" aria-label="${escapeHtml(languages.zoomOut)}">−</button>
        <span class="fn__flex-1 fn__flex-center ft__center" data-value></span>
        <button class="b3-button b3-button--outline" data-action="increase" aria-label="${escapeHtml(languages.zoomIn)}">+</button>
    </div>
    <div class="fn__hr"></div>
    <div class="b3-label__text">${escapeHtml(languages.inputFontSizeTip)}</div>
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" data-action="follow">${escapeHtml(languages.inputFontSizeFollow)}</button>
</div>`,
        bind(element) {
            refreshPanel(element);
            element.addEventListener("click", async (event) => {
                const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
                if (!button || button.disabled) {
                    return;
                }
                event.stopPropagation();
                const current = getInputFontSize() || window.siyuan.config.editor.fontSize;
                const action = button.dataset.action;
                try {
                    if (action === "follow") {
                        await saveInputFontSize(null);
                    } else {
                        const next = current + (action === "increase" ? 1 : -1);
                        await saveInputFontSize(Math.min(INPUT_FONT_SIZE_MAX, Math.max(INPUT_FONT_SIZE_MIN, next)));
                    }
                } catch (error) {
                    console.error("save input font size failed", error);
                }
                refreshPanel(element);
            });
        },
    }).element);
    let rect = target.getBoundingClientRect();
    if (rect.width === 0) {
        // 按钮被收进「更多」菜单时，面板显示在「更多」按钮下方
        rect = document.getElementById("barMore").getBoundingClientRect();
    }
    menu.popup({x: rect.right, y: rect.bottom, h: rect.height, isLeft: true});
};
