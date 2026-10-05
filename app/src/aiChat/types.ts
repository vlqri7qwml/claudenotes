/** 对话中一段内容的角色；note 表示没有说话人标记的普通文字。 */
export type ChatRole = "user" | "assistant" | "thinking" | "note";

export type ChatSource = "claude" | "chatgpt" | "gemini" | "deepseek" | "kimi" | "doubao" | "generic";

export interface ChatTurn {
    role: ChatRole;
    /** Markdown 正文 */
    markdown: string;
}

export interface ChatConversation {
    /** 稳定 ID，用于重复导入时去重，形如 `claude:<uuid>` */
    id: string;
    source: ChatSource;
    title: string;
    /** ISO 8601 时间 */
    createdAt?: string;
    turns: ChatTurn[];
}

/** HTML 片段转 Markdown，运行时由 Lute 提供。 */
export type HtmlToMarkdown = (html: string) => string;

/** 解析时写入笔记正文的占位文字，由调用方按界面语言提供。 */
export interface ChatTextLabels {
    untitled: string;
    image: string;
    audio: string;
}

export const DEFAULT_CHAT_TEXT_LABELS: ChatTextLabels = {
    untitled: "Untitled chat",
    image: "[Image]",
    audio: "[Audio]",
};

/** 各来源的产品名，用作导入时的目录名；通用来源由调用方按界面语言命名。 */
export const CHAT_SOURCE_NAMES: Record<Exclude<ChatSource, "generic">, string> = {
    claude: "Claude",
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    deepseek: "DeepSeek",
    kimi: "Kimi",
    doubao: "Doubao",
};
