import {Constants} from "../constants";
import {fetchSyncPost} from "../util/fetch";
import {chatSourceFolder, conversationToKramdown, safeDocTitle} from "./render";
import type {ChatConversation} from "./types";

export interface ChatNotebook {
    id: string;
    name: string;
    closed: boolean;
}

interface IKernelResponse {
    code: number;
    msg: string;
    data: unknown;
}

/** 等待内核接口返回，失败时抛出带内核提示的错误。 */
const kernel = async <T>(response: Promise<IKernelResponse>): Promise<T> => {
    const result = await response;
    if (!result || result.code !== 0) {
        throw new Error(result?.msg || "request failed");
    }
    return result.data as T;
};

export const listChatNotebooks = async (): Promise<ChatNotebook[]> => {
    const data = await kernel<{ notebooks: ChatNotebook[] | null } | null>(
        fetchSyncPost("/api/notebook/lsNotebooks", {}));
    return (data?.notebooks || []).filter(Boolean);
};

/** 找到同名笔记本（必要时打开），没有则新建，返回笔记本 ID。 */
export const ensureChatNotebook = async (name: string) => {
    const found = (await listChatNotebooks()).find(notebook => notebook.name === name);
    if (found) {
        if (found.closed) {
            await kernel(fetchSyncPost("/api/notebook/openNotebook", {notebook: found.id}));
        }
        return found.id;
    }
    const data = await kernel<{ notebook: ChatNotebook | null }>(
        fetchSyncPost("/api/notebook/createNotebook", {name}));
    return data.notebook.id;
};

/** 已经导入过的对话 ID（文档属性 custom-sy-chat-id）。 */
export const loadImportedChatIds = async () => {
    const rows = await kernel<Array<Record<string, unknown> | null>>(fetchSyncPost("/api/query/sql", {
        stmt: `SELECT value FROM attributes WHERE name = '${Constants.CUSTOM_SY_CHAT_ID}' LIMIT 1000000`,
    }));
    return new Set((rows || []).map(row => String(row?.value || "")).filter(Boolean));
};

/** 导入位置所在的可读路径，笔记本根目录为空字符串。 */
export const getChatImportParentHPath = async (notebookId: string, path: string) => {
    if (!path || path === "/") {
        return "";
    }
    const hPath = await kernel<string>(fetchSyncPost("/api/filetree/getHPathByPath", {
        notebook: notebookId,
        path,
    }));
    return hPath === "/" ? "" : hPath.replace(/\/$/, "");
};

export interface ChatImportOptions {
    notebookId: string;
    /** 导入位置的可读路径，对话按来源放在其下的子目录中 */
    parentHPath: string;
    includeThinking: boolean;
    /** 来源不明的对话放在这个目录下 */
    otherFolder: string;
    /** 豆包的目录名 */
    doubaoFolder: string;
    untitled: string;
}

export type ChatImportResult = { status: "created", id: string } | { status: "skipped" };

/** 每个对话导入为一篇文档，路径为 <导入位置>/<来源>/<标题>，已导入过的跳过。 */
export const importChatConversation = async (conv: ChatConversation, options: ChatImportOptions,
                                             imported: Set<string>): Promise<ChatImportResult> => {
    if (imported.has(conv.id)) {
        return {status: "skipped"};
    }
    const id = await kernel<string>(fetchSyncPost("/api/filetree/createDocWithMd", {
        notebook: options.notebookId,
        path: `${options.parentHPath}/${chatSourceFolder(conv.source, options)}/${
            safeDocTitle(conv.title, options.untitled)}`,
        markdown: conversationToKramdown(conv, {includeThinking: options.includeThinking}),
    }));
    const attrs: Record<string, string> = {
        [Constants.CUSTOM_SY_CHAT_ID]: conv.id,
        [Constants.CUSTOM_SY_CHAT_SOURCE]: conv.source,
    };
    if (conv.createdAt) {
        attrs[Constants.CUSTOM_SY_CHAT_CREATED] = conv.createdAt;
    }
    await kernel(fetchSyncPost("/api/attr/setBlockAttrs", {id, attrs}));
    imported.add(conv.id);
    return {status: "created", id};
};
