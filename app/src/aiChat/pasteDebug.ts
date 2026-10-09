import * as dayjs from "dayjs";
import {Constants} from "../constants";

/**
 * 粘贴最终的处理方式：blockDOM 为思源内部数据或识别出的 AI 对话，html 为网页富文本经内核转换，
 * markdown 为纯文本按 Markdown 解析，code 为粘贴到代码中，其余见 paste.ts 中的调用处。
 */
export type TPastePath = "blockDOM" | "code" | "codeBlock" | "html" | "link" | "markdown" | "files" | "restricted" |
    "wps";

interface IPasteRecord {
    time: string;
    /** paste 为键盘或菜单粘贴，drop 为拖放 */
    source: "paste" | "drop";
    /** 剪贴板中的数据类型 */
    types: string[];
    html: string;
    plain: string;
    hasSiyuanData: boolean;
    path?: TPastePath;
    /** 识别为 AI 对话时的来源和轮数 */
    aiChat?: { source: string, turns: number };
    /** 插件替换了剪贴板内容 */
    pluginReplaced?: boolean;
}

// 只在内存中保留最近一次粘贴，供 设置 - 编辑器 - AI 对话 导出排查粘贴问题
let lastPaste: IPasteRecord | undefined;

export const recordPaste = (source: IPasteRecord["source"], types: readonly string[] | undefined, html: string,
                            plain: string, siyuan: string) => {
    lastPaste = {
        time: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        source,
        // 菜单粘贴通过内核读取剪贴板，没有类型列表，按已读取的内容推断
        types: types ? Array.from(types) : [
            html ? "text/html" : "",
            plain ? "text/plain" : "",
            siyuan ? "text/siyuan" : "",
        ].filter(Boolean),
        html: html || "",
        plain: plain || "",
        hasSiyuanData: !!siyuan,
    };
};

export const recordPastePath = (path: TPastePath) => {
    if (lastPaste) {
        lastPaste.path = path;
    }
};

export const recordPasteAIChat = (source: string, turns: number) => {
    if (lastPaste) {
        lastPaste.aiChat = {source, turns};
    }
};

export const recordPastePluginReplaced = () => {
    if (lastPaste) {
        lastPaste.pluginReplaced = true;
    }
};

/** 把最近一次粘贴保存为 JSON 文件，没有记录时返回 false。 */
export const exportLastPaste = () => {
    if (!lastPaste) {
        return false;
    }
    const data = {
        app: "ClaudeNotes",
        version: Constants.SIYUAN_VERSION,
        os: window.siyuan.config.system.os,
        ...lastPaste,
    };
    const blob = new Blob([JSON.stringify(data, undefined, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `claudenotes-paste-${dayjs().format("YYYYMMDD-HHmmss")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
};
