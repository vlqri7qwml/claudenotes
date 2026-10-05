import {Constants} from "../constants";
import {setStorageVal} from "../protyle/util/compatibility";

/** 粘贴时是否识别 AI 网页对话，默认开启。 */
export const isAIChatPasteEnabled = (): boolean => {
    return window.siyuan.storage?.[Constants.LOCAL_AI_CHAT_PASTE] !== false;
};

export const setAIChatPasteEnabled = (enabled: boolean): void => {
    window.siyuan.storage[Constants.LOCAL_AI_CHAT_PASTE] = enabled;
    setStorageVal(Constants.LOCAL_AI_CHAT_PASTE, enabled);
};

/** 粘贴和导入对话时是否保留思考过程，默认不保留。 */
export const isAIChatThinkingIncluded = (): boolean => {
    return window.siyuan.storage?.[Constants.LOCAL_AI_CHAT_THINKING] === true;
};

export const setAIChatThinkingIncluded = (included: boolean): void => {
    window.siyuan.storage[Constants.LOCAL_AI_CHAT_THINKING] = included;
    setStorageVal(Constants.LOCAL_AI_CHAT_THINKING, included);
};
