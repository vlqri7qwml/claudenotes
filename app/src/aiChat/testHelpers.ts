import {DOMParser as LinkedomParser} from "linkedom";
import type {HtmlToMarkdown} from "./types";

// 测试环境：constants.ts 依赖构建时注入的全局变量；linkedom 只接受完整文档，这里补齐外壳以模拟浏览器 DOMParser
(globalThis as any).SIYUAN_VERSION = "test";
(globalThis as any).NODE_ENV = "test";

class FragmentDOMParser {
    parseFromString(html: string, type: string) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head></head><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type as "text/html");
    }
}

(globalThis as any).DOMParser = FragmentDOMParser;

require("../../stage/protyle/js/lute/lute.min.js");

interface ITestLute {
    HTML2Md: (html: string) => string;
    Md2BlockDOM: (markdown: string) => string;
}

/** 与编辑器（protyle/render/setLute.ts）一致的关键选项 */
export const lute: ITestLute = (() => {
    const engine = (globalThis as any).Lute.New();
    ["SetKramdownIAL", "SetSuperBlock", "SetCallout", "SetTabs", "SetProtyleWYSIWYG", "SetBlockRef", "SetTag",
        "SetInlineMath", "SetGFMStrikethrough", "SetMark", "SetImgPathAllowSpace"].forEach(name => engine[name]?.(true));
    ["SetSetext", "SetFootnotes", "SetLinkRef", "SetToC", "SetIndentCodeBlock", "SetYamlFrontMatter"]
        .forEach(name => engine[name]?.(false));
    return engine;
})();

export const toMarkdown: HtmlToMarkdown = html => lute.HTML2Md(html);
