import * as assert from "node:assert/strict";
import {describe, test} from "node:test";
import {parseHTML} from "linkedom";
import {
    applyFontSizeToBlockDOM,
    hasBlockFontSize,
    isEmptyParagraphHTML,
    normalizeInputFontSize,
} from "./inputFontSizeCore";

const {document: doc} = parseHTML("<!doctype html><html><body></body></html>");

const paragraph = (id: string, content: string, style = "") =>
    `<div data-node-id="${id}" data-type="NodeParagraph" class="p"${style ? ` style="${style}"` : ""}>` +
    `<div contenteditable="true" spellcheck="false">${content}</div><div class="protyle-attr" contenteditable="false">\u200b</div></div>`;

const parse = (html: string) => {
    const template = doc.createElement("template");
    template.innerHTML = `<div>${html}</div>`;
    return template.content.firstElementChild;
};

describe("新输入字号", () => {
    test("只接受 9 到 72 的整数像素值", () => {
        assert.equal(normalizeInputFontSize(14), 14);
        assert.equal(normalizeInputFontSize(9), 9);
        assert.equal(normalizeInputFontSize(72), 72);
        assert.equal(normalizeInputFontSize(8), null);
        assert.equal(normalizeInputFontSize(14.5), null);
        assert.equal(normalizeInputFontSize("14"), null);
        assert.equal(normalizeInputFontSize(null), null);
    });

    test("空段落：只有零宽字符或空白算空，有文字、图片或行内元素不算", () => {
        assert.equal(isEmptyParagraphHTML(paragraph("1", ""), doc), true);
        assert.equal(isEmptyParagraphHTML(paragraph("1", "\u200b \n"), doc), true);
        assert.equal(isEmptyParagraphHTML(paragraph("1", "x"), doc), false);
        assert.equal(isEmptyParagraphHTML(paragraph("1", '<img src="a.png">'), doc), false);
        assert.equal(isEmptyParagraphHTML(paragraph("1", '<span data-type="inline-math" data-content="x"></span>'), doc), false);
        assert.equal(isEmptyParagraphHTML('<div data-node-id="1" data-type="NodeHeading" class="h2">' +
            '<div contenteditable="true"></div></div>', doc), false);
    });

    test("粘贴的段落和表格加上字号，标题和代码块不变", () => {
        const html = '<div data-node-id="h" data-type="NodeHeading" class="h2"><div contenteditable="true">标题</div></div>' +
            paragraph("p", "正文") +
            '<div data-node-id="l" data-type="NodeList" class="list"><div data-node-id="li" data-type="NodeListItem" class="li">' +
            paragraph("lp", "列表项") + "</div></div>" +
            '<div data-node-id="c" data-type="NodeCodeBlock" class="code-block"></div>' +
            '<div data-node-id="t" data-type="NodeTable" class="table"><table></table></div>';
        const result = parse(applyFontSizeToBlockDOM(html, 14, doc));
        const sizeOf = (id: string) => result.querySelector<HTMLElement>(`[data-node-id="${id}"]`).style.fontSize;
        assert.equal(sizeOf("p"), "14px");
        assert.equal(sizeOf("lp"), "14px");
        assert.equal(sizeOf("t"), "14px");
        assert.equal(sizeOf("h"), "");
        assert.equal(sizeOf("c"), "");
        assert.equal(sizeOf("li"), "");
    });

    test("已有字号的段落、设有字号的容器内的段落保持原样；未设置时不改动", () => {
        const styled = paragraph("p", "正文", "font-size: 20px");
        assert.equal(parse(applyFontSizeToBlockDOM(styled, 14, doc)).querySelector<HTMLElement>("[data-node-id]")
            .style.fontSize, "20px");
        const nested = '<div data-node-id="s" data-type="NodeSuperBlock" class="sb" style="font-size: 18px">' +
            paragraph("p", "正文") + "</div>";
        const result = parse(applyFontSizeToBlockDOM(nested, 14, doc));
        assert.equal(result.querySelector<HTMLElement>('[data-node-id="p"]').style.fontSize, "");
        assert.equal(hasBlockFontSize(result.querySelector('[data-node-id="p"]')), true);
        const plain = paragraph("p", "正文");
        assert.equal(applyFontSizeToBlockDOM(plain, null, doc), plain);
    });
});
