import {Constants} from "../constants";
import {CHAT_SOURCE_NAMES, type ChatConversation, type ChatSource, type ChatTurn} from "./types";

export interface RenderOptions {
    /** 是否保留思考过程 */
    includeThinking?: boolean;
}

/** 正文里单独一行的 `}}}` 会提前结束超级块，加零宽字符规避。 */
const escapeSuperBlockEnd = (markdown: string) =>
    markdown.replace(/^(\s*)\}\}\}\s*$/gm, `$1${Constants.ZWSP}}}}`);

/**
 * 把对话转为 Kramdown：每一轮是一个超级块，用块属性 custom-sy-chat-role 标记角色，
 * 编辑器按该属性显示为提问气泡、回答正文或折叠的思考过程。没有角色的段落按普通块输出。
 */
export const turnsToKramdown = (turns: ChatTurn[], source: ChatSource, options: RenderOptions = {}) => {
    const blocks: string[] = [];
    for (const turn of turns) {
        const markdown = turn.markdown.trim();
        if (!markdown || (turn.role === "thinking" && !options.includeThinking)) {
            continue;
        }
        if (turn.role === "note") {
            blocks.push(markdown);
            continue;
        }
        const fold = turn.role === "thinking" ? " fold=\"1\"" : "";
        blocks.push(`{{{row\n${escapeSuperBlockEnd(markdown)}\n}}}\n` +
            `{: ${Constants.CUSTOM_SY_CHAT_ROLE}="${turn.role}" ${Constants.CUSTOM_SY_CHAT_SOURCE}="${source}"${fold}}`);
    }
    return blocks.join("\n\n") + "\n";
};

export const conversationToKramdown = (conv: ChatConversation, options: RenderOptions = {}) =>
    turnsToKramdown(conv.turns, conv.source, options);

/** 文档名不能包含路径分隔符，过长时截断。 */
export const safeDocTitle = (title: string, fallback: string) =>
    (title || fallback).replace(/[/\\]/g, "／").replace(/[\r\n\t]+/g, " ").trim().slice(0, 120) || fallback;

/** 导入时按来源分目录；通用来源和豆包的目录名由调用方按界面语言提供。 */
export const chatSourceFolder = (source: ChatSource, folders: { otherFolder: string, doubaoFolder: string }) => {
    if (source === "generic") {
        return folders.otherFolder;
    }
    return source === "doubao" ? folders.doubaoFolder : CHAT_SOURCE_NAMES[source];
};
