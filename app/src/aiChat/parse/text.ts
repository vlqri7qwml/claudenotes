import type {ChatRole, ChatSource, ChatTurn} from "../types";

// 说话人标签，长的写在前面，避免 "you" 先于 "you said" 命中
const USER_LABELS = [
    "you said", "you", "user", "human", "me", "question", "q",
    "您说", "你说", "用户\\s*\\(user\\)", "用户", "提问", "问题", "问", "我",
];
const ASSISTANT_LABELS = [
    "chatgpt said", "chatgpt\\s*说", "claude said", "gemini said", "assistant", "chatgpt", "claude", "gemini",
    "deepseek", "kimi", "doubao", "answer", "ai", "a",
    "助手\\s*\\(assistant\\)", "助手", "豆包", "回答", "答",
];
// 只允许出现在「标签：」形式里的短标签，作为单独标题时太容易误判
const COLON_ONLY = new Set(["q", "a", "me", "ai", "我", "问", "答"]);

const labelGroup = (labels: string[]) => labels.join("|");
const ALL_LABELS = labelGroup([...USER_LABELS, ...ASSISTANT_LABELS]);
// 「**User:** 内容」「User：内容」「## Human: 内容」「> **Claude**: 内容」
const COLON_LINE = new RegExp(
    `^\\s*(?:[#>]+\\s*)?(?:\\*\\*|__)?\\s*(${ALL_LABELS})\\s*(?:\\*\\*|__)?\\s*[:：]\\s*(?:\\*\\*|__)?\\s*(.*)$`, "i");
// 「## 用户 (User) - 2026/1/1 12:00:00」「### Claude」
const HEADING_LINE = new RegExp(
    `^\\s*#{1,6}\\s*(?:\\*\\*)?\\s*(${ALL_LABELS})\\s*(?:\\*\\*)?\\s*(?:[-–—]\\s+.*)?$`, "i");
const USER_RE = new RegExp(`^(?:${labelGroup(USER_LABELS)})$`, "i");

const roleOfLabel = (label: string): ChatRole => {
    return USER_RE.test(label.trim()) ? "user" : "assistant";
};

interface LabelHit {
    role: ChatRole;
    rest: string;
}

const matchLabel = (line: string): LabelHit | null => {
    const colon = COLON_LINE.exec(line);
    if (colon) {
        return {role: roleOfLabel(colon[1]), rest: colon[2].replace(/(?:\*\*|__)\s*$/, "")};
    }
    const heading = HEADING_LINE.exec(line);
    if (heading && !COLON_ONLY.has(heading[1].trim().toLowerCase())) {
        return {role: roleOfLabel(heading[1]), rest: ""};
    }
    return null;
};

/** 合并相邻同角色的段落，去掉空段。 */
export const normalizeTurns = (turns: ChatTurn[]): ChatTurn[] => {
    const result: ChatTurn[] = [];
    for (const turn of turns) {
        const markdown = turn.markdown.replace(/^\s*\n/, "").replace(/\s+$/, "");
        if (!markdown.trim()) {
            continue;
        }
        const last = result[result.length - 1];
        if (last && last.role === turn.role) {
            last.markdown += "\n\n" + markdown;
        } else {
            result.push({role: turn.role, markdown});
        }
    }
    return result;
};

export interface TextParseResult {
    title?: string;
    turns: ChatTurn[];
}

/**
 * 按说话人标签把纯文本 / Markdown 切分为对话。
 * 至少同时出现提问和回答标签才认为是对话，否则返回 null。
 */
export const parseConversationText = (text: string): TextParseResult | null => {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const turns: ChatTurn[] = [];
    let current: ChatTurn = {role: "note", markdown: ""};
    let fence: string | null = null;
    let hasUser = false;
    let hasAssistant = false;

    for (const line of lines) {
        const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
        if (fenceMatch) {
            if (!fence) {
                fence = fenceMatch[1];
            } else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
                fence = null;
            }
        }
        const hit = fence || fenceMatch ? null : matchLabel(line);
        if (hit) {
            turns.push(current);
            current = {role: hit.role, markdown: hit.rest ? hit.rest + "\n" : ""};
            if (hit.role === "user") {
                hasUser = true;
            } else {
                hasAssistant = true;
            }
            continue;
        }
        current.markdown += line + "\n";
    }
    turns.push(current);

    if (!hasUser || !hasAssistant) {
        return null;
    }
    let title: string | undefined;
    const first = turns[0];
    if (first.role === "note") {
        const heading = /^\s*#\s+(.+?)\s*$/m.exec(first.markdown);
        if (heading) {
            title = heading[1];
            first.markdown = first.markdown.replace(heading[0], "");
        }
    }
    return {title, turns: normalizeTurns(turns)};
};

/** 根据说话人标签猜测来源网站。 */
export const guessSourceFromText = (text: string): ChatSource => {
    if (/^\s*(?:#+\s*)?(?:\*\*)?ChatGPT/im.test(text)) {
        return "chatgpt";
    }
    if (/^\s*(?:#+\s*)?(?:\*\*)?Claude/im.test(text)) {
        return "claude";
    }
    if (/^\s*(?:#+\s*)?(?:\*\*)?Gemini/im.test(text)) {
        return "gemini";
    }
    if (/^\s*(?:#+\s*)?(?:\*\*)?DeepSeek/im.test(text)) {
        return "deepseek";
    }
    return "generic";
};
