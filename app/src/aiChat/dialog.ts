import type {App} from "../index";
import {Dialog} from "../dialog";
import {showMessage} from "../dialog/message";
import {escapeHtml} from "../util/escape";
import {isMobile} from "../util/functions";
import {getAgentLute} from "../protyle/render/setLute";
/// #if MOBILE
import {openMobileFileById} from "../mobile/editor";
/// #else
import {openFileById} from "../editor/util";
/// #endif
import {
    ensureChatNotebook,
    getChatImportParentHPath,
    importChatConversation,
    listChatNotebooks,
    loadImportedChatIds,
} from "./importer";
import {parseChatFile, SUPPORTED_EXTENSIONS} from "./parse/files";
import {chatSourceFolder} from "./render";
import {isAIChatThinkingIncluded, setAIChatThinkingIncluded} from "./preference";
import type {ChatConversation, ChatTextLabels} from "./types";

interface IChatImportRow {
    conv: ChatConversation;
    selected: boolean;
    existing: boolean;
}

export interface IChatImportDialogOptions {
    /** 从笔记本或文档的「导入」菜单打开时导入到该位置，否则在对话框中选择笔记本 */
    notebookId?: string;
    path?: string;
}

const NEW_NOTEBOOK = "__new__";

// 思源的 SQL 索引会延迟几秒，记录本次运行中导入过的对话，与查询结果合并后去重
const importedThisSession = new Set<string>();

const format = (template: string, x: string | number, y?: string | number) =>
    template.replace("${x}", String(x)).replace("${y}", String(y ?? ""));

const getTextLabels = (): ChatTextLabels => ({
    untitled: window.siyuan.languages.aiChatUntitled,
    image: window.siyuan.languages.aiChatImage,
    audio: window.siyuan.languages.aiChatAudio,
});

let fileLute: Lute;
const fileToMarkdown = (html: string) => {
    fileLute = fileLute || getAgentLute({emojiSite: "/emojis", emojis: {}, sanitize: true});
    return fileLute.HTML2Md(html);
};

const openImportedDoc = (app: App, id: string) => {
    /// #if MOBILE
    openMobileFileById(app, id);
    /// #else
    openFileById({app, id});
    /// #endif
};

/** 导入本地聊天记录：Claude / ChatGPT / DeepSeek 官方导出、通用 JSON、Markdown、TXT、HTML。 */
export const openChatImportDialog = (app: App, options: IChatImportDialogOptions = {}) => {
    const languages = window.siyuan.languages;
    const fixedTarget = !!options.notebookId;
    const dialog = new Dialog({
        title: languages.aiChatImport,
        width: isMobile() ? "92vw" : "760px",
        height: isMobile() ? "80vh" : "72vh",
        content: `<div class="b3-dialog__content ai-chat-import">
    <div class="ai-chat-import__drop" data-type="drop">
        <svg class="ai-chat-import__icon"><use xlink:href="#iconChat"></use></svg>
        <div>${languages.aiChatDropHint} <button class="b3-button b3-button--outline" data-type="pick">${languages.aiChatPickFiles}</button></div>
        <div class="b3-label__text">${languages.aiChatSupportedFormats}</div>
        <input type="file" multiple accept="${SUPPORTED_EXTENSIONS.join(",")}" class="fn__none">
    </div>
    <div class="ai-chat-import__toolbar fn__none">
        <input class="b3-text-field fn__flex-1" data-type="search" placeholder="${languages.aiChatSearchTitle}">
        <label class="ai-chat-import__check"><input class="b3-switch" type="checkbox" data-type="all" checked>${languages.aiChatSelectAll}</label>
    </div>
    <div class="ai-chat-import__list"></div>
    <div class="ai-chat-import__status b3-label__text"></div>
</div>
<div class="b3-dialog__action ai-chat-import__action">
    <select class="b3-select${fixedTarget ? " fn__none" : ""}" data-type="notebook"></select>
    <label class="ai-chat-import__check"><input class="b3-switch" type="checkbox" data-type="thinking"${isAIChatThinkingIncluded() ? " checked" : ""}>${languages.aiChatThinking}</label>
    <div class="fn__flex-1"></div>
    <button class="b3-button b3-button--cancel" data-type="cancel">${languages.cancel}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-type="import" disabled>${format(languages.aiChatImportCount, 0)}</button>
</div>`,
    });
    const root = dialog.element;
    const fileInput = root.querySelector<HTMLInputElement>("input[type=file]");
    const listElement = root.querySelector<HTMLElement>(".ai-chat-import__list");
    const statusElement = root.querySelector<HTMLElement>(".ai-chat-import__status");
    const searchInput = root.querySelector<HTMLInputElement>("[data-type=search]");
    const allCheckbox = root.querySelector<HTMLInputElement>("[data-type=all]");
    const notebookSelect = root.querySelector<HTMLSelectElement>("[data-type=notebook]");
    const thinkingCheckbox = root.querySelector<HTMLInputElement>("[data-type=thinking]");
    const importButton = root.querySelector<HTMLButtonElement>("[data-type=import]");
    const dropElement = root.querySelector<HTMLElement>("[data-type=drop]");
    const rows: IChatImportRow[] = [];
    const labels = getTextLabels();
    let busy = false;
    const importedIds = loadImportedChatIds().catch((): Set<string> => new Set()).then(ids => {
        ids.forEach(id => importedThisSession.add(id));
        return importedThisSession;
    });

    const setStatus = (text: string) => {
        statusElement.textContent = text;
    };

    const visibleRows = () => {
        const keyword = searchInput.value.trim().toLowerCase();
        return rows.filter(row => !keyword || row.conv.title.toLowerCase().includes(keyword));
    };

    const updateImportButton = () => {
        const count = rows.filter(row => row.selected && !row.existing).length;
        importButton.textContent = format(languages.aiChatImportCount, count);
        importButton.disabled = busy || count === 0;
    };

    const render = () => {
        root.querySelector(".ai-chat-import__toolbar").classList.toggle("fn__none", rows.length === 0);
        dropElement.classList.toggle("ai-chat-import__drop--compact", rows.length > 0);
        listElement.innerHTML = visibleRows().map(row => {
            const index = rows.indexOf(row);
            const date = row.conv.createdAt ? row.conv.createdAt.slice(0, 10) : "";
            const meta = [chatSourceFolder(row.conv.source, {
                otherFolder: languages.aiChatOtherSource,
                doubaoFolder: languages.aiChatSourceDoubao,
            }), date, format(languages.aiChatTurns, row.conv.turns.length)].filter(Boolean).join(" · ");
            return `<label class="b3-list-item ai-chat-import__row${row.existing ? " ai-chat-import__row--existing" : ""}">
    <input class="b3-switch" type="checkbox" data-index="${index}"${row.selected && !row.existing ? " checked" : ""}${row.existing ? " disabled" : ""}>
    <span class="b3-list-item__text">${escapeHtml(row.conv.title)}</span>
    ${row.existing ? `<span class="b3-chip b3-chip--small">${languages.aiChatImported}</span>` : ""}
    <span class="b3-list-item__meta">${escapeHtml(meta)}</span>
</label>`;
        }).join("");
        updateImportButton();
    };

    const loadNotebooks = async () => {
        if (fixedTarget) {
            return;
        }
        const notebooks = await listChatNotebooks().catch((): Awaited<ReturnType<typeof listChatNotebooks>> => []);
        const defaultName = languages.aiChatDefaultNotebook;
        const current = notebookSelect.value;
        const preferred = notebooks.find(notebook => notebook.id === current) ||
            notebooks.find(notebook => notebook.name === defaultName);
        notebookSelect.innerHTML = (notebooks.some(notebook => notebook.name === defaultName) ? "" :
            `<option value="${NEW_NOTEBOOK}">${escapeHtml(defaultName)}${languages.aiChatNewNotebook}</option>`) +
            notebooks.map(notebook => `<option value="${notebook.id}"${notebook === preferred ? " selected" : ""}>${
                escapeHtml(notebook.name)}</option>`).join("");
    };
    loadNotebooks();

    const handleFiles = async (fileList: FileList | File[]) => {
        // FileList 是实时的，清空 input 后会变空，需在第一个 await 之前复制出来
        const files = Array.from(fileList);
        const known = new Set(rows.map(row => row.conv.id));
        const ids = await importedIds;
        const messages: string[] = [];
        for (const file of files) {
            setStatus(format(languages.aiChatParsing, file.name));
            try {
                const convs = parseChatFile(file.name, new Uint8Array(await file.arrayBuffer()), fileToMarkdown, labels);
                if (convs.length === 0) {
                    messages.push(format(languages.aiChatNoConversation, file.name));
                }
                convs.filter(conv => !known.has(conv.id)).forEach(conv => {
                    known.add(conv.id);
                    rows.push({conv, selected: true, existing: ids.has(conv.id)});
                });
            } catch (error) {
                messages.push(format(languages.aiChatParseFailed, file.name, (error as Error).message));
            }
        }
        rows.sort((a, b) => (b.conv.createdAt || "").localeCompare(a.conv.createdAt || ""));
        setStatus(messages.join("\n"));
        render();
    };

    root.querySelector("[data-type=pick]").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        if (fileInput.files?.length) {
            handleFiles(fileInput.files);
            fileInput.value = "";
        }
    });
    dropElement.addEventListener("dragover", event => {
        event.preventDefault();
        dropElement.classList.add("ai-chat-import__drop--over");
    });
    dropElement.addEventListener("dragleave", () => dropElement.classList.remove("ai-chat-import__drop--over"));
    dropElement.addEventListener("drop", event => {
        event.preventDefault();
        dropElement.classList.remove("ai-chat-import__drop--over");
        if (event.dataTransfer?.files.length) {
            handleFiles(event.dataTransfer.files);
        }
    });
    searchInput.addEventListener("input", render);
    allCheckbox.addEventListener("change", () => {
        visibleRows().forEach(row => {
            row.selected = allCheckbox.checked;
        });
        render();
    });
    listElement.addEventListener("change", event => {
        const target = event.target as HTMLInputElement;
        const row = rows[Number(target.dataset.index)];
        if (row) {
            row.selected = target.checked;
            updateImportButton();
        }
    });
    thinkingCheckbox.addEventListener("change", () => setAIChatThinkingIncluded(thinkingCheckbox.checked));
    root.querySelector("[data-type=cancel]").addEventListener("click", () => dialog.destroy());

    importButton.addEventListener("click", async () => {
        const targets = rows.filter(row => row.selected && !row.existing);
        if (busy || targets.length === 0) {
            return;
        }
        busy = true;
        updateImportButton();
        let created = 0;
        let skipped = 0;
        let failed = 0;
        let lastError = "";
        let firstId = "";
        try {
            const notebookId = options.notebookId || (notebookSelect.value === NEW_NOTEBOOK ?
                await ensureChatNotebook(languages.aiChatDefaultNotebook) : notebookSelect.value);
            const parentHPath = await getChatImportParentHPath(notebookId, options.path);
            const ids = await importedIds;
            for (let i = 0; i < targets.length; i++) {
                setStatus(format(languages.aiChatImporting, i, targets.length));
                try {
                    const result = await importChatConversation(targets[i].conv, {
                        notebookId,
                        parentHPath,
                        includeThinking: thinkingCheckbox.checked,
                        otherFolder: languages.aiChatOtherSource,
                        doubaoFolder: languages.aiChatSourceDoubao,
                        untitled: labels.untitled,
                    }, ids);
                    if (result.status === "created") {
                        created++;
                        firstId = firstId || result.id;
                    } else {
                        skipped++;
                    }
                    targets[i].existing = true;
                } catch (error) {
                    failed++;
                    lastError = (error as Error).message;
                }
            }
        } catch (error) {
            failed = targets.length;
            lastError = (error as Error).message;
        }
        busy = false;
        const summary = format(languages.aiChatImportDone, created, skipped) +
            (failed ? format(languages.aiChatImportFailed, failed, lastError) : "");
        setStatus(summary);
        showMessage(summary, failed ? 0 : 6000, failed ? "error" : "info");
        render();
        await loadNotebooks();
        if (firstId) {
            if (isMobile()) {
                dialog.destroy();
            }
            openImportedDoc(app, firstId);
        }
    });
    return dialog;
};
