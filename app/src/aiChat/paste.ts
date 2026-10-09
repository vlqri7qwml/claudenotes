import {detectPastedConversation} from "./parse/detect";
import {turnsToKramdown} from "./render";
import {isAIChatPasteEnabled, isAIChatThinkingIncluded} from "./preference";

// 粘贴到这些块中时按原样处理，不识别对话
const PLAIN_PASTE_BLOCK_TYPES = ["NodeCodeBlock", "NodeTable", "NodeAttributeView", "NodeHTMLBlock", "NodeMathBlock"];

const isInlineCodeRange = (range?: Range) => {
    const container = range?.startContainer;
    const element = container instanceof Element ? container : container?.parentElement;
    return !!element?.closest("code, [data-type~=\"code\"]");
};

/**
 * 识别从 AI 网页复制的对话（网页 DOM 标记或纯文本里的说话人标签），返回可直接插入的块 DOM：
 * 每一轮是带 custom-sy-chat-role 的超级块。不是对话或粘贴位置不适合时返回空字符串。
 */
export const getAIChatPasteBlockDOM = (protyle: IProtyle, textHTML: string, textPlain: string,
                                       blockElement?: Element | null, range?: Range): string => {
    if (!isAIChatPasteEnabled() || (!textHTML && !textPlain) || !protyle.lute ||
        PLAIN_PASTE_BLOCK_TYPES.includes(blockElement?.getAttribute("data-type")) || isInlineCodeRange(range)) {
        return "";
    }
    let conversation;
    try {
        conversation = detectPastedConversation(textHTML || "", textPlain || "",
            (html) => protyle.lute.HTML2Md(html));
    } catch (error) {
        console.error("detect pasted AI chat failed", error);
        return "";
    }
    if (!conversation) {
        return "";
    }
    return protyle.lute.Md2BlockDOM(turnsToKramdown(conversation.turns, conversation.source,
        {includeThinking: isAIChatThinkingIncluded()}));
};
