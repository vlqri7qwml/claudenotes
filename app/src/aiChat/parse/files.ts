import {unzipSync} from "fflate";
import {
    type ChatConversation,
    type ChatRole,
    type ChatSource,
    type ChatTextLabels,
    type ChatTurn,
    DEFAULT_CHAT_TEXT_LABELS,
    type HtmlToMarkdown,
} from "../types";
import {htmlToPlainMarkdown, parseConversationHTML} from "./html";
import {guessSourceFromText, normalizeTurns, parseConversationText} from "./text";

export const SUPPORTED_EXTENSIONS = [".zip", ".json", ".md", ".markdown", ".txt", ".html", ".htm"];

/** FNV-1a 32 位哈希，用于给没有 ID 的对话生成稳定 ID。 */
export const hashString = (text: string) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
};

const extOf = (name: string) => {
    const match = /\.[^./\\]+$/.exec(name);
    return match ? match[0].toLowerCase() : "";
};

const baseName = (name: string) => name.split(/[/\\]/).pop()!.replace(/\.[^.]+$/, "");

const toISO = (value: unknown) => {
    if (typeof value === "number" && isFinite(value)) {
        return new Date(value < 1e12 ? value * 1000 : value).toISOString();
    }
    if (typeof value === "string" && value) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    return undefined;
};

/** 选一个比内容中所有反引号串都长的围栏。 */
const fenceFor = (content: string) => {
    const longest = Math.max(2, ...Array.from(content.matchAll(/`+/g), match => match[0].length));
    return "`".repeat(longest + 1);
};

export const codeBlock = (content: string, lang = "") => {
    const fence = fenceFor(content);
    return `${fence}${lang}\n${content.replace(/\n$/, "")}\n${fence}`;
};

const titleFromTurns = (turns: ChatTurn[], fallback: string) => {
    const question = turns.find(turn => turn.role === "user");
    const line = question?.markdown.split("\n").map(item => item.replace(/^[#>*\s-]+/, "").trim()).find(Boolean);
    if (!line) {
        return fallback;
    }
    return line.length > 40 ? line.slice(0, 40) + "..." : line;
};

const makeConversation = (source: ChatSource, rawId: string, title: string, turns: ChatTurn[],
                          labels: ChatTextLabels, createdAt?: string): ChatConversation => {
    const normalized = normalizeTurns(turns);
    return {
        id: `${source}:${rawId}`,
        source,
        title: (title || "").trim() || titleFromTurns(normalized, labels.untitled),
        createdAt,
        turns: normalized,
    };
};

// ---------- Claude 官方导出（conversations.json） ----------

const ARTIFACT_LANGS: Record<string, string> = {
    "text/html": "html",
    "application/vnd.ant.react": "jsx",
    "image/svg+xml": "svg",
    "application/vnd.ant.mermaid": "mermaid",
    "text/markdown": "markdown",
};

const artifactMarkdown = (title: string, type: string, language: string, content: string) => {
    const lang = language || ARTIFACT_LANGS[type] || "";
    const heading = `**📄 ${title || "Artifact"}**`;
    if (lang === "markdown") {
        return `${heading}\n\n${content.trim()}`;
    }
    return `${heading}\n\n${codeBlock(content, lang)}`;
};

const attrOf = (attrs: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] || "";

/** 旧版 Claude 导出把 artifact 内嵌在正文的 <antArtifact> 标签里。 */
const convertInlineArtifacts = (text: string) => text
    .replace(/<antThinking>[\s\S]*?<\/antThinking>/g, "")
    .replace(/<antArtifact\b([^>]*)>([\s\S]*?)<\/antArtifact>/g, (_all, attrs: string, content: string) =>
        "\n\n" + artifactMarkdown(attrOf(attrs, "title"), attrOf(attrs, "type"), attrOf(attrs, "language"),
            content.replace(/^\n/, "")) + "\n\n");

const fromClaude = (conv: any, labels: ChatTextLabels): ChatConversation => {
    const turns: ChatTurn[] = [];
    for (const message of conv.chat_messages || []) {
        const role: ChatRole = message.sender === "human" ? "user" : "assistant";
        const parts: any[] = Array.isArray(message.content) && message.content.length > 0 ?
            message.content : [{type: "text", text: message.text || ""}];
        let buffer: string[] = [];
        const flush = () => {
            if (buffer.length > 0) {
                turns.push({role, markdown: buffer.join("\n\n")});
                buffer = [];
            }
        };
        for (const part of parts) {
            if (part?.type === "text" && typeof part.text === "string") {
                buffer.push(convertInlineArtifacts(part.text));
            } else if (part?.type === "thinking" && typeof part.thinking === "string") {
                flush();
                turns.push({role: "thinking", markdown: part.thinking});
            } else if (part?.type === "tool_use" && typeof part.input?.content === "string") {
                buffer.push(artifactMarkdown(part.input.title, part.input.type, part.input.language, part.input.content));
            }
        }
        const fileNames = [...(message.attachments || []), ...(message.files || [])]
            .map((file: any) => file?.file_name).filter(Boolean);
        if (fileNames.length > 0) {
            buffer.push(fileNames.map((fileName: string) => `📎 ${fileName}`).join("\n"));
        }
        flush();
    }
    return makeConversation("claude", conv.uuid || hashString(JSON.stringify(conv).slice(0, 4000)), conv.name, turns,
        labels, toISO(conv.created_at));
};

// ---------- ChatGPT / DeepSeek 导出（mapping 树） ----------

// ChatGPT 导出中的引用标记：U+E200 与 U+E201 之间的内容，以及旧版的【数字†来源】
const stripChatGPTCitations = (text: string) => text
    .replace(/\ue200[^\ue201]*\ue201/g, "")
    .replace(/【\d+(?::\d+)?†[^】]*】/g, "");

const mappingPath = (conv: any): any[] => {
    const mapping = conv.mapping || {};
    const path: any[] = [];
    if (conv.current_node && mapping[conv.current_node]) {
        for (let node = mapping[conv.current_node]; node; node = node.parent ? mapping[node.parent] : null) {
            path.unshift(node);
            if (path.length > 100000) {
                break;
            }
        }
        return path;
    }
    // 没有 current_node 时沿每层最后一个子节点（最新分支）向下走
    let node = Object.values(mapping).find((item: any) => !item?.parent || !mapping[item.parent]);
    while (node) {
        path.push(node);
        const children: string[] = (node as any).children || [];
        node = children.length > 0 ? mapping[children[children.length - 1]] : null;
        if (path.length > 100000) {
            break;
        }
    }
    return path;
};

const chatGPTTurn = (message: any, labels: ChatTextLabels): ChatTurn | null => {
    const role = message?.author?.role;
    if (!message || message.metadata?.is_visually_hidden_from_conversation ||
        (role !== "user" && role !== "assistant")) {
        return null;
    }
    if (role === "assistant" && message.recipient && message.recipient !== "all") {
        return null;
    }
    const content = message.content || {};
    switch (content.content_type) {
        case "thoughts": {
            const thoughts = (content.thoughts || []).map((thought: any) =>
                (thought.summary ? `**${thought.summary}**\n\n` : "") + (thought.content || "")).join("\n\n");
            return thoughts.trim() ? {role: "thinking", markdown: thoughts} : null;
        }
        case "reasoning_recap":
        case "user_editable_context":
        case "code":
        case "execution_output":
            return null;
        default: {
            const parts: any[] = Array.isArray(content.parts) ? content.parts : [];
            const text = parts.map(part => {
                if (typeof part === "string") {
                    return part;
                }
                if (part?.content_type === "image_asset_pointer") {
                    return labels.image;
                }
                if (part?.content_type?.startsWith?.("audio")) {
                    return labels.audio;
                }
                return typeof part?.text === "string" ? part.text : "";
            }).join("\n");
            const markdown = stripChatGPTCitations(text || content.text || "");
            return markdown.trim() ? {role, markdown} : null;
        }
    }
};

const DEEPSEEK_ROLES: Record<string, ChatRole> = {REQUEST: "user", RESPONSE: "assistant", THINK: "thinking"};

const fromMapping = (conv: any, labels: ChatTextLabels): ChatConversation => {
    const nodes = mappingPath(conv);
    const isDeepSeek = nodes.some(node => Array.isArray(node?.message?.fragments));
    const turns: ChatTurn[] = [];
    for (const node of nodes) {
        if (isDeepSeek) {
            for (const fragment of node?.message?.fragments || []) {
                const role = DEEPSEEK_ROLES[String(fragment?.type || "").toUpperCase()];
                if (role && typeof fragment.content === "string") {
                    turns.push({role, markdown: fragment.content});
                }
            }
        } else {
            const turn = chatGPTTurn(node?.message, labels);
            if (turn) {
                turns.push(turn);
            }
        }
    }
    const source: ChatSource = isDeepSeek ? "deepseek" : "chatgpt";
    const rawId = conv.conversation_id || conv.id || hashString((conv.title || "") + (conv.create_time || "") +
        JSON.stringify(turns.slice(0, 2)));
    return makeConversation(source, rawId, conv.title, turns, labels, toISO(conv.create_time ?? conv.inserted_at));
};

// ---------- 通用 [{role, content}] ----------

const GENERIC_ROLES: Record<string, ChatRole> = {
    user: "user", human: "user", me: "user",
    assistant: "assistant", ai: "assistant", bot: "assistant", model: "assistant", gpt: "assistant",
    claude: "assistant", chatgpt: "assistant",
    thinking: "thinking", reasoning: "thinking",
};

const genericContent = (content: any): string => {
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content.map(item => typeof item === "string" ? item : (item?.text ?? item?.content ?? ""))
            .filter(item => typeof item === "string").join("\n\n");
    }
    if (content && typeof content === "object") {
        return genericContent(content.parts ?? content.text ?? "");
    }
    return "";
};

const isRoleMessage = (item: any) => item && typeof item === "object" &&
    typeof (item.role ?? item.sender ?? item.author) === "string" &&
    (item.content !== undefined || item.text !== undefined || item.parts !== undefined);

const fromGeneric = (messages: any[], title: string, labels: ChatTextLabels, rawId?: string,
                     createdAt?: unknown): ChatConversation => {
    const turns: ChatTurn[] = [];
    for (const message of messages) {
        const role = GENERIC_ROLES[String(message?.role ?? message?.sender ?? message?.author ?? "").toLowerCase()];
        if (!role) {
            continue;
        }
        if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
            turns.push({role: "thinking", markdown: message.reasoning_content});
        }
        const markdown = genericContent(message.content ?? message.text ?? message.parts);
        if (markdown.trim()) {
            turns.push({role, markdown});
        }
    }
    return makeConversation("generic", rawId || hashString(title + JSON.stringify(turns.slice(0, 4))), title, turns,
        labels, toISO(createdAt));
};

export const parseChatJSON = (json: unknown, fallbackTitle: string,
                              labels = DEFAULT_CHAT_TEXT_LABELS): ChatConversation[] => {
    const items: any[] = Array.isArray(json) ? json : [json];
    if (items.length > 0 && isRoleMessage(items[0])) {
        return [fromGeneric(items, fallbackTitle, labels)].filter(conv => conv.turns.length > 0);
    }
    const result: ChatConversation[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") {
            continue;
        }
        if (Array.isArray(item.chat_messages)) {
            result.push(fromClaude(item, labels));
        } else if (item.mapping && typeof item.mapping === "object") {
            result.push(fromMapping(item, labels));
        } else if (Array.isArray(item.messages)) {
            result.push(fromGeneric(item.messages, item.title || item.name || fallbackTitle, labels, item.id,
                item.created_at ?? item.createdAt ?? item.create_time));
        }
    }
    return result.filter(conv => conv.turns.length > 0);
};

// ---------- Markdown / 文本 / HTML ----------

export const parseChatText = (text: string, fileName: string,
                              labels = DEFAULT_CHAT_TEXT_LABELS): ChatConversation[] => {
    const parsed = parseConversationText(text);
    const title = parsed?.title || baseName(fileName);
    const turns = parsed ? parsed.turns : [{role: "note" as ChatRole, markdown: text}];
    const conv = makeConversation(parsed ? guessSourceFromText(text) : "generic", hashString(text), title, turns,
        labels);
    return conv.turns.length > 0 ? [conv] : [];
};

const cleanPageTitle = (title: string) => title
    .replace(/\s*[-–|]\s*(Claude|ChatGPT|Gemini|DeepSeek|Kimi.*|豆包.*)\s*$/i, "")
    .replace(/^\s*(ChatGPT|Gemini|DeepSeek)\s*[-–|]\s*/i, "")
    .trim();

export const parseChatHTML = (html: string, fileName: string, toMarkdown: HtmlToMarkdown,
                              labels = DEFAULT_CHAT_TEXT_LABELS): ChatConversation[] => {
    const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() || "";
    const title = cleanPageTitle(pageTitle.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")) ||
        baseName(fileName);
    const parsed = parseConversationHTML(html, toMarkdown);
    if (parsed) {
        return [makeConversation(parsed.source, hashString(html), title, parsed.turns, labels)];
    }
    const markdown = htmlToPlainMarkdown(html, toMarkdown);
    return parseChatText(markdown, fileName, labels).map(conv => ({...conv, title}));
};

// ---------- 入口 ----------

const decode = (data: Uint8Array) => new TextDecoder("utf-8").decode(data).replace(/^\ufeff/, "");

const parseEntry = (name: string, data: Uint8Array, toMarkdown: HtmlToMarkdown,
                    labels: ChatTextLabels): ChatConversation[] => {
    const ext = extOf(name);
    if (ext === ".json") {
        return parseChatJSON(JSON.parse(decode(data)), baseName(name), labels);
    }
    if (ext === ".html" || ext === ".htm") {
        return parseChatHTML(decode(data), name, toMarkdown, labels);
    }
    if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
        return parseChatText(decode(data), name, labels);
    }
    throw new Error(`unsupported file type: ${name}`);
};

/** 解析一个本地聊天文件（zip 会展开其中的 json / md / txt / html）。 */
export const parseChatFile = (name: string, data: Uint8Array, toMarkdown: HtmlToMarkdown,
                              labels = DEFAULT_CHAT_TEXT_LABELS): ChatConversation[] => {
    if (extOf(name) !== ".zip") {
        return parseEntry(name, data, toMarkdown, labels);
    }
    const entries = unzipSync(data, {
        filter: file => !file.name.startsWith("__MACOSX/") && /\.(json|md|markdown|txt|html?)$/i.test(file.name),
    });
    const names = Object.keys(entries);
    // 官方导出包里只有 conversations.json 是对话，chat.html 等是同一内容的另一种形式
    const conversationFiles = names.filter(entry => /(^|\/)conversations\.json$/i.test(entry));
    const targets = conversationFiles.length > 0 ? conversationFiles : names;
    const result: ChatConversation[] = [];
    for (const entry of targets) {
        try {
            result.push(...parseEntry(entry, entries[entry], toMarkdown, labels));
        } catch (error) {
            if (conversationFiles.length > 0) {
                throw error;
            }
        }
    }
    return result;
};
