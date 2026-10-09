import type {ChatSource, ChatTurn, HtmlToMarkdown} from "../types";
import {parseConversationHTML} from "./html";
import {guessSourceFromText, parseConversationText} from "./text";

export interface DetectedConversation {
    source: ChatSource;
    turns: ChatTurn[];
}

/** 判断剪贴板内容是否是一段 AI 对话：先看网页 DOM 标记，再看纯文本里的说话人标签。 */
export const detectPastedConversation = (textHTML: string, textPlain: string,
                                         toMarkdown: HtmlToMarkdown): DetectedConversation | null => {
    const fromHTML = parseConversationHTML(textHTML, toMarkdown);
    if (fromHTML) {
        return fromHTML;
    }
    const fromText = parseConversationText(textPlain || "");
    if (fromText) {
        return {source: guessSourceFromText(textPlain), turns: fromText.turns};
    }
    return null;
};
