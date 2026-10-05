import {lute, toMarkdown} from "./testHelpers";
import * as assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, test} from "node:test";
import {strToU8, zipSync} from "fflate";
import {parseConversationHTML} from "./parse/html";
import {parseConversationText} from "./parse/text";
import {detectPastedConversation} from "./parse/detect";
import {parseChatFile} from "./parse/files";
import {chatSourceFolder, safeDocTitle, turnsToKramdown} from "./render";

const fixturePath = (name: string) => resolve(process.cwd(), "src/aiChat/fixtures", name);
const fixture = (name: string) => readFileSync(fixturePath(name), "utf8");
const fixtureBytes = (name: string) => new Uint8Array(readFileSync(fixturePath(name)));
const zhLabels = {untitled: "未命名对话", image: "[图片]", audio: "[音频]"};
const roles = (turns: { role: string }[]) => turns.map(turn => turn.role);

describe("网页复制的 HTML", () => {
    test("Claude：区分提问和回答，去掉头像、按钮和代码块上方的语言标签", () => {
        const result = parseConversationHTML(fixture("claude.html"), toMarkdown);
        assert.ok(result);
        assert.equal(result.source, "claude");
        assert.deepEqual(roles(result.turns), ["user", "assistant", "user", "assistant"]);
        assert.equal(result.turns[0].markdown, "How do I sort a list in Python?");
        assert.doesNotMatch(result.turns[0].markdown, /GN/);
        assert.doesNotMatch(result.turns[1].markdown, /Copy|Retry/);
        assert.match(result.turns[1].markdown, /```python\nnums = sorted\(nums\)\n```/);
        assert.doesNotMatch(result.turns[1].markdown, /^python$/m);
        assert.match(result.turns[1].markdown, /\|\s*Method\s*\|\s*Stable\s*\|/);
        assert.match(result.turns[1].markdown, /\$O\(n \\log n\)\$/);
    });

    test("ChatGPT：按 data-message-author-role 切分，代码块保留语言、去掉 Copy code", () => {
        const result = parseConversationHTML(fixture("chatgpt.html"), toMarkdown);
        assert.ok(result);
        assert.equal(result.source, "chatgpt");
        assert.deepEqual(roles(result.turns), ["user", "assistant"]);
        assert.doesNotMatch(result.turns[1].markdown, /Copy code/);
        assert.match(result.turns[1].markdown, /```javascript\nconst add = a => b => a \+ b;\n```/);
    });

    for (const [name, source] of [["gemini.html", "gemini"], ["kimi.html", "kimi"], ["doubao.html", "doubao"]]) {
        test(`${source}：识别一问一答`, () => {
            const result = parseConversationHTML(fixture(name), toMarkdown);
            assert.ok(result);
            assert.equal(result.source, source);
            assert.deepEqual(roles(result.turns), ["user", "assistant"]);
        });
    }

    test("DeepSeek：回答之间的文字作为提问，去掉「已深度思考」和按钮文字，思考过程单独标记", () => {
        const result = parseConversationHTML(fixture("deepseek.html"), toMarkdown);
        assert.ok(result);
        assert.equal(result.source, "deepseek");
        assert.deepEqual(roles(result.turns), ["user", "thinking", "assistant"]);
        assert.equal(result.turns[0].markdown, "什么是 Rust 的所有权？");
        assert.doesNotMatch(result.turns[2].markdown, /复制/);
    });

    test("普通网页不当作对话", () => {
        assert.equal(parseConversationHTML(fixture("plain-article.html"), toMarkdown), null);
        assert.equal(detectPastedConversation(fixture("plain-article.html"), "Just a normal paragraph.", toMarkdown), null);
    });
});

describe("纯文本说话人标签", () => {
    test("ChatGPT 全选复制的文本，代码块里的标签不切分", () => {
        const result = parseConversationText(fixture("chatgpt-copy-all.txt"));
        assert.ok(result);
        assert.deepEqual(roles(result.turns), ["user", "assistant", "user", "assistant"]);
        assert.match(result.turns[1].markdown, /User: this line is inside a code block/);
    });

    test(".ai 导出的「## 用户 (User) - 时间」格式，并取一级标题作为标题", () => {
        const result = parseConversationText(fixture("dot-ai-export.md"));
        assert.ok(result);
        assert.equal(result.title, "神经网络框架设计");
        assert.deepEqual(roles(result.turns), ["user", "assistant", "user"]);
    });

    test("行内标签：**User:** / Claude：", () => {
        const result = parseConversationText("**User:** 你好\n\nClaude：你好，有什么可以帮你？\n\n用户：讲个笑话\n\n答：好的");
        assert.ok(result);
        assert.deepEqual(roles(result.turns), ["user", "assistant", "user", "assistant"]);
        assert.equal(result.turns[0].markdown, "你好");
    });

    test("只有一种角色时不是对话", () => {
        assert.equal(parseConversationText("Q: 只有问题\n没有回答"), null);
        assert.equal(parseConversationText(fixture("notes.md")), null);
    });
});

describe("本地聊天文件", () => {
    test("Claude 官方导出：思考过程、artifact、附件、旧版 antArtifact、空对话", () => {
        const convs = parseChatFile("conversations.json", fixtureBytes("claude-export.json"), toMarkdown);
        assert.equal(convs.length, 2);
        const [first, second] = convs;
        assert.equal(first.id, "claude:c0ffee00-0000-4000-8000-000000000001");
        assert.equal(first.title, "Python 排序");
        assert.equal(first.createdAt, "2025-03-01T08:00:00.000Z");
        assert.deepEqual(roles(first.turns), ["user", "thinking", "assistant"]);
        assert.match(first.turns[0].markdown, /📎 data\.csv/);
        assert.match(first.turns[2].markdown, /\*\*📄 sort\.py\*\*\n\n```python\nprint\(sorted\(\[3, 1, 2\]\)\)\n```/);
        assert.equal(second.title, "Draw a diagram");
        assert.match(second.turns[1].markdown, /```mermaid\ngraph TD; A-->B\n```/);
    });

    test("ChatGPT 导出：沿 current_node 取当前分支，跳过系统/工具消息，去掉引用标记", () => {
        const convs = parseChatFile("conversations.json", fixtureBytes("chatgpt-export.json"), toMarkdown, zhLabels);
        assert.equal(convs.length, 2);
        const [first, second] = convs;
        assert.equal(first.id, "chatgpt:conv-1");
        assert.equal(first.createdAt, new Date(1700000000500).toISOString());
        assert.deepEqual(roles(first.turns), ["user", "thinking", "assistant", "user"]);
        assert.equal(first.turns[0].markdown, "[图片]\nWhat is in this picture?");
        assert.equal(first.turns[2].markdown, "A cat sitting.");
        assert.equal(first.turns[3].markdown, "new branch question");
        assert.deepEqual(roles(second.turns), ["user", "assistant"]);
        assert.equal(second.turns[1].markdown, "It is 4.");
    });

    test("DeepSeek 导出：fragments 中的 REQUEST / THINK / RESPONSE", () => {
        const convs = parseChatFile("deepseek.json", fixtureBytes("deepseek-export.json"), toMarkdown);
        assert.equal(convs.length, 1);
        assert.equal(convs[0].source, "deepseek");
        assert.deepEqual(roles(convs[0].turns), ["user", "thinking", "assistant"]);
    });

    test("通用 messages 格式", () => {
        const convs = parseChatFile("chat.json", fixtureBytes("generic.json"), toMarkdown);
        assert.equal(convs.length, 1);
        assert.equal(convs[0].title, "Generic chat");
        assert.deepEqual(roles(convs[0].turns), ["user", "thinking", "assistant"]);
    });

    test("zip：只读取其中的 conversations.json", () => {
        const zip = zipSync({
            "conversations.json": fixtureBytes("claude-export.json"),
            "users.json": strToU8("[{\"uuid\":\"u\"}]"),
            "chat.html": strToU8("<html><body>duplicate</body></html>"),
            "image.png": new Uint8Array([1, 2, 3]),
        });
        const convs = parseChatFile("data-2025.zip", zip, toMarkdown);
        assert.equal(convs.length, 2);
        assert.equal(convs[0].source, "claude");
    });

    test("Markdown / 文本 / HTML 文件", () => {
        const md = parseChatFile("神经网络.md", fixtureBytes("dot-ai-export.md"), toMarkdown);
        assert.equal(md[0].title, "神经网络框架设计");
        assert.deepEqual(roles(md[0].turns), ["user", "assistant", "user"]);

        const plain = parseChatFile("普通笔记.md", fixtureBytes("notes.md"), toMarkdown);
        assert.deepEqual(roles(plain[0].turns), ["note"]);
        assert.equal(plain[0].title, "普通笔记");

        const html = `<html><head><title>Python 排序 - Claude</title></head><body>${fixture("claude.html")}</body></html>`;
        const fromHTML = parseChatFile("saved.html", new TextEncoder().encode(html), toMarkdown);
        assert.equal(fromHTML[0].title, "Python 排序");
        assert.equal(fromHTML[0].source, "claude");
    });

    test("同一文件重复解析得到相同 ID，用于去重", () => {
        const a = parseChatFile("a.md", fixtureBytes("dot-ai-export.md"), toMarkdown);
        const b = parseChatFile("b.md", fixtureBytes("dot-ai-export.md"), toMarkdown);
        assert.equal(a[0].id, b[0].id);
    });
});

describe("渲染为思源 Kramdown", () => {
    const turns = [
        {role: "note" as const, markdown: "前言"},
        {role: "user" as const, markdown: "问题"},
        {role: "thinking" as const, markdown: "想一想"},
        {role: "assistant" as const, markdown: "回答\n}}}\n```js\nx\n```"},
    ];

    test("每轮一个超级块并带角色属性，思考过程默认不输出", () => {
        const kramdown = turnsToKramdown(turns, "claude");
        assert.match(kramdown, /^前言\n\n\{\{\{row\n问题\n\}\}\}\n\{: custom-sy-chat-role="user" custom-sy-chat-source="claude"\}/);
        assert.doesNotMatch(kramdown, /想一想/);
        assert.match(kramdown, /\u200b\}\}\}/);
        assert.match(turnsToKramdown(turns, "claude", {includeThinking: true}),
            /custom-sy-chat-role="thinking" custom-sy-chat-source="claude" fold="1"/);
    });

    test("Lute 解析后得到带 custom-sy-chat-role 的块", () => {
        const dom = lute.Md2BlockDOM(turnsToKramdown(turns, "claude"));
        assert.equal((dom.match(/custom-sy-chat-role="user"/g) || []).length, 1);
        assert.equal((dom.match(/custom-sy-chat-role="assistant"/g) || []).length, 1);
        assert.match(dom, /data-type="NodeCodeBlock"/);
        assert.equal((dom.match(/data-type="NodeSuperBlock"/g) || []).length, 2);
    });
});

describe("导入位置与文档名", () => {
    test("按来源分目录，通用来源和豆包使用界面语言的目录名", () => {
        const folders = {otherFolder: "其他", doubaoFolder: "豆包"};
        assert.equal(chatSourceFolder("claude", folders), "Claude");
        assert.equal(chatSourceFolder("generic", folders), "其他");
        assert.equal(chatSourceFolder("doubao", folders), "豆包");
    });

    test("文档名去掉路径分隔符和换行，空标题使用默认名称", () => {
        assert.equal(safeDocTitle("a/b\\c\nd", "未命名对话"), "a／b／c d");
        assert.equal(safeDocTitle("  ", "未命名对话"), "未命名对话");
    });

    test("未指定占位文字时使用英文", () => {
        const convs = parseChatFile("conversations.json", fixtureBytes("chatgpt-export.json"), toMarkdown);
        assert.equal(convs[0].turns[0].markdown, "[Image]\nWhat is in this picture?");
    });
});
