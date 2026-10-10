/// #if !BROWSER
import {ipcRenderer} from "electron";
/// #endif
import {Constants} from "../constants";
import {
    applyFontSizeToBlockDOM,
    hasBlockFontSize,
    isEmptyParagraphHTML,
    normalizeInputFontSize,
    setBlockFontSize,
} from "./inputFontSizeCore";

// 桌面端保存在 ClaudeNotesData/config/editor-input.json，所有工作空间共用；浏览器中保存在 localStorage
const STORAGE_KEY = "claudenotes-input-font-size";

let inputFontSize: number | null = null;

/** 当前的新输入字号，null 表示跟随编辑器字号 */
export const getInputFontSize = () => inputFontSize;

export const loadInputFontSize = async () => {
    try {
        /// #if !BROWSER
        const result = await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "getInputFontSize"});
        inputFontSize = normalizeInputFontSize(result?.fontSize);
        /// #else
        inputFontSize = normalizeInputFontSize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
        /// #endif
    } catch (error) {
        console.warn("load input font size failed", error);
    }
    return inputFontSize;
};

export const saveInputFontSize = async (fontSize: number | null) => {
    const value = normalizeInputFontSize(fontSize);
    /// #if !BROWSER
    const result = await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "setInputFontSize", fontSize: value});
    inputFontSize = normalizeInputFontSize(result?.fontSize);
    /// #else
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
        console.warn("save input font size failed", error);
    }
    inputFontSize = value;
    /// #endif
    return inputFontSize;
};

let initialized = false;

/** 启动时读取一次；其他窗口可能修改了设置，窗口重新获得焦点时再读取 */
export const initInputFontSize = () => {
    if (initialized) {
        return;
    }
    initialized = true;
    void loadInputFontSize();
    window.addEventListener("focus", () => {
        void loadInputFontSize();
    });
};

const isStyleTarget = (blockElement: Element) => {
    return blockElement?.getAttribute("data-type") === "NodeParagraph" &&
        !hasBlockFontSize(blockElement, blockElement.closest(".protyle-wysiwyg"));
};

/** 输入前为空的段落在第一次输入时使用新输入字号；在已有文字的段落里输入保持原样 */
export const applyInputFontSizeOnFirstInput = (blockElement: HTMLElement, oldHTML?: string) => {
    if (!inputFontSize || !oldHTML || !isStyleTarget(blockElement) || !isEmptyParagraphHTML(oldHTML)) {
        return false;
    }
    setBlockFontSize(blockElement, inputFontSize);
    return true;
};

/** 粘贴前光标所在的空段落使用新输入字号，粘贴的单段文字合并进来时随之使用该字号 */
export const applyInputFontSizeToEmptyBlock = (blockElement?: Element | false | null) => {
    if (!inputFontSize || !blockElement || !isStyleTarget(blockElement) ||
        !isEmptyParagraphHTML(blockElement.outerHTML)) {
        return false;
    }
    setBlockFontSize(blockElement as HTMLElement, inputFontSize);
    return true;
};

/** 给外部粘贴进来的段落和表格加上新输入字号 */
export const applyInputFontSizeToBlockDOM = (html: string) => {
    return applyFontSizeToBlockDOM(html, inputFontSize);
};
