import type {ChatRole, ChatSource, ChatTurn, HtmlToMarkdown} from "../types";
import {normalizeTurns} from "./text";

interface SiteRule {
    source: ChatSource;
    /** 提问所在元素 */
    user: string;
    /** 回答所在元素 */
    assistant: string;
}

/**
 * 各网站对话页的 DOM 标记。从网页复制时浏览器会把选区祖先元素连同属性一起写入 text/html，
 * 据此区分提问和回答。网站改版后只需更新这张表。
 */
export const SITE_RULES: SiteRule[] = [
    {source: "claude", user: "[data-testid=\"user-message\"]", assistant: ".font-claude-response, .font-claude-message"},
    {source: "chatgpt", user: "[data-message-author-role=\"user\"]", assistant: "[data-message-author-role=\"assistant\"]"},
    {source: "gemini", user: "user-query", assistant: "model-response"},
    {
        source: "kimi",
        user: ".chat-content-item-user, .segment-user",
        assistant: ".chat-content-item-assistant, .segment-assistant",
    },
    {source: "doubao", user: "[data-testid=\"send_message\"]", assistant: "[data-testid=\"receive_message\"]"},
];

// DeepSeek 只有回答带稳定的类名，提问取回答之间的文字
const DEEPSEEK_ANSWER = ".ds-markdown";
// 复制整页时混进来的界面文字
const CHROME_LINE = /^(已深度思考|已思考|思考中|深度思考|Thought for|Thinking|Copy|Copied|复制|已复制|重新生成|Regenerate|编辑|Edit|分享|Share|内容由\s*AI\s*生成|本回答由\s*AI\s*生成)(?:\s*[（(:：\d].{0,40})?\s*$/i;

const REMOVE_SELECTOR = "button, svg, script, style, noscript, textarea, input, select, [role=\"button\"], .sr-only";

const outermost = (elements: Element[]) =>
    elements.filter(element => !elements.some(other => other !== element && other.contains(element)));

/** 代码块只保留 <code>，并补上语言，去掉网站在代码块上方显示的语言标签。 */
const normalizeCodeBlocks = (root: Element) => {
    root.querySelectorAll("pre").forEach(pre => {
        const code = pre.querySelector("code");
        if (!code) {
            return;
        }
        let lang = /(?:^|\s)(?:language|lang)-([\w+#.-]+)/.exec(code.getAttribute("class") || "")?.[1] || "";
        if (!lang) {
            const label = Array.from(pre.querySelectorAll("div, span"))
                .filter(element => !element.contains(code) && !code.contains(element))
                .map(element => (element.textContent || "").trim())
                .find(text => /^[A-Za-z][\w+#.-]{0,20}$/.test(text));
            lang = label || "";
        }
        const newCode = pre.ownerDocument.createElement("code");
        newCode.textContent = code.textContent || "";
        if (lang) {
            newCode.setAttribute("class", "language-" + lang);
        }
        pre.innerHTML = "";
        pre.appendChild(newCode);
        if (lang) {
            [pre.previousElementSibling, pre.parentElement?.previousElementSibling].forEach(element => {
                if (element && (element.textContent || "").trim().toLowerCase() === lang.toLowerCase()) {
                    element.remove();
                }
            });
        }
    });
};

const cleanElement = (element: Element) => {
    element.querySelectorAll(REMOVE_SELECTOR).forEach(item => item.remove());
    normalizeCodeBlocks(element);
};

const elementToMarkdown = (element: Element, toMarkdown: HtmlToMarkdown) => {
    const clone = element.cloneNode(true) as Element;
    cleanElement(clone);
    const markdown = toMarkdown(clone.innerHTML).trim();
    return markdown || (clone.textContent || "").trim();
};

const stripChromeLines = (markdown: string) =>
    markdown.split("\n").filter(line => !CHROME_LINE.test(line.trim())).join("\n").trim();

const parseBySiteRules = (body: HTMLElement, toMarkdown: HtmlToMarkdown) => {
    for (const rule of SITE_RULES) {
        const matched = outermost(Array.from(body.querySelectorAll(`${rule.user}, ${rule.assistant}`)));
        if (matched.length === 0) {
            continue;
        }
        const turns: ChatTurn[] = matched.map(element => ({
            role: (element.matches(rule.user) ? "user" : "assistant") as ChatRole,
            markdown: elementToMarkdown(element, toMarkdown),
        }));
        const normalized = normalizeTurns(turns);
        if (normalized.length > 0) {
            return {source: rule.source, turns: normalized};
        }
    }
    return null;
};

const parseDeepSeek = (body: HTMLElement, toMarkdown: HtmlToMarkdown) => {
    const clone = body.cloneNode(true) as HTMLElement;
    const answers = outermost(Array.from(clone.querySelectorAll(DEEPSEEK_ANSWER)));
    if (answers.length === 0) {
        return null;
    }
    const answerTurns: ChatTurn[] = answers.map((element, index) => {
        let thinking = false;
        for (let parent = element.parentElement; parent && parent !== clone; parent = parent.parentElement) {
            if (/think/i.test(parent.getAttribute("class") || "")) {
                thinking = true;
                break;
            }
        }
        const turn: ChatTurn = {
            role: thinking ? "thinking" : "assistant",
            markdown: elementToMarkdown(element, toMarkdown),
        };
        const marker = clone.ownerDocument.createElement("sy-chat-split");
        marker.setAttribute("data-index", String(index));
        element.replaceWith(marker);
        return turn;
    });
    const segments = clone.innerHTML.split(/<sy-chat-split[^>]*><\/sy-chat-split>/);
    const turns: ChatTurn[] = [];
    segments.forEach((segment, index) => {
        const segmentBody = new DOMParser().parseFromString(segment, "text/html").body;
        cleanElement(segmentBody);
        const question = stripChromeLines(toMarkdown(segmentBody.innerHTML));
        if (question) {
            turns.push({role: "user", markdown: question});
        }
        if (answerTurns[index]) {
            turns.push(answerTurns[index]);
        }
    });
    return {source: "deepseek" as ChatSource, turns: normalizeTurns(turns)};
};

export interface HtmlParseResult {
    source: ChatSource;
    turns: ChatTurn[];
}

/** 从网页复制的 HTML 中识别对话，没有任何站点标记时返回 null。 */
export const parseConversationHTML = (html: string, toMarkdown: HtmlToMarkdown): HtmlParseResult | null => {
    if (!html || !html.trim()) {
        return null;
    }
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (!body) {
        return null;
    }
    const result = parseBySiteRules(body, toMarkdown) || parseDeepSeek(body, toMarkdown);
    return result && result.turns.length > 0 ? result : null;
};

/** 把整段 HTML 转为 Markdown，供没有站点标记的 .html 文件使用。 */
export const htmlToPlainMarkdown = (html: string, toMarkdown: HtmlToMarkdown) => {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (!body) {
        return "";
    }
    return elementToMarkdown(body, toMarkdown);
};
