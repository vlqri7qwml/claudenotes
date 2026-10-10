// 新输入字号：之后新起的段落和外部粘贴的内容使用的字号，写在块属性 style 上；已有文字不受影响。

/** 取值范围与编辑器字号一致 */
export const INPUT_FONT_SIZE_MIN = 9;
export const INPUT_FONT_SIZE_MAX = 72;

// 只给段落和表格设置字号，标题、代码块、公式等保持各自的样式
const STYLED_BLOCK_TYPES = ["NodeParagraph", "NodeTable"];

/** 整数像素值，超出范围或不是整数时返回 null（跟随编辑器字号） */
export const normalizeInputFontSize = (value: unknown): number | null => {
    return typeof value === "number" && Number.isInteger(value) &&
    value >= INPUT_FONT_SIZE_MIN && value <= INPUT_FONT_SIZE_MAX ? value : null;
};

/** 块自身或所在的容器块已设置字号时返回 true，root 为向上查找的边界 */
export const hasBlockFontSize = (element: Element, root?: Element) => {
    for (let item: Element | null = element; item && item !== root; item = item.parentElement) {
        if (item.hasAttribute("data-node-id") && (item as HTMLElement).style?.fontSize) {
            return true;
        }
    }
    return false;
};

export const setBlockFontSize = (element: HTMLElement, fontSize: number) => {
    element.style.fontSize = fontSize + "px";
};

/** 段落块的可编辑区域中没有文字和行内元素（忽略零宽字符与空白） */
export const isEmptyParagraphHTML = (html: string, doc: Document = document) => {
    const template = doc.createElement("template");
    template.innerHTML = html;
    const block = template.content.firstElementChild;
    if (!block || block.getAttribute("data-type") !== "NodeParagraph") {
        return false;
    }
    const editable = block.querySelector('[contenteditable="true"]');
    if (!editable || editable.querySelector("img, video, audio, iframe, [data-type]")) {
        return false;
    }
    return (editable.textContent || "").replace(/\u200b|\u200d|\ufeff|\s/g, "") === "";
};

/** 给块 DOM 中的段落和表格加上字号，已在设有字号的容器内的不重复设置 */
export const applyFontSizeToBlockDOM = (html: string, fontSize: number | null, doc: Document = document) => {
    if (!fontSize || !html) {
        return html;
    }
    // 在惰性的 template 中解析，外层包一个 div 以便取回修改后的 HTML
    const template = doc.createElement("template");
    template.innerHTML = `<div>${html}</div>`;
    const wrapper = template.content.firstElementChild;
    let changed = false;
    wrapper.querySelectorAll<HTMLElement>("[data-node-id]").forEach(item => {
        if (!STYLED_BLOCK_TYPES.includes(item.getAttribute("data-type")) || hasBlockFontSize(item)) {
            return;
        }
        setBlockFontSize(item, fontSize);
        changed = true;
    });
    return changed ? wrapper.innerHTML : html;
};
