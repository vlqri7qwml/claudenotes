const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {normalizeInputFontSize, readInputFontSize, writeInputFontSize} = require("./inputFontSize");

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "claudenotes-input-font-")), "editor-input.json");

test("新输入字号只接受 9 到 72 的整数", () => {
    assert.equal(normalizeInputFontSize(14), 14);
    assert.equal(normalizeInputFontSize(9), 9);
    assert.equal(normalizeInputFontSize(72), 72);
    assert.equal(normalizeInputFontSize(8), null);
    assert.equal(normalizeInputFontSize(73), null);
    assert.equal(normalizeInputFontSize(14.5), null);
    assert.equal(normalizeInputFontSize("14"), null);
    assert.equal(normalizeInputFontSize(null), null);
});

test("没有设置文件或文件损坏时跟随编辑器字号", () => {
    const file = tempFile();
    assert.equal(readInputFontSize(file), null);
    fs.writeFileSync(file, "{");
    assert.equal(readInputFontSize(file), null);
    fs.writeFileSync(file, JSON.stringify({fontSize: 100}));
    assert.equal(readInputFontSize(file), null);
});

test("保存后读取到相同的字号，可以清除", () => {
    const file = tempFile();
    writeInputFontSize(file, 14);
    assert.equal(readInputFontSize(file), 14);
    writeInputFontSize(file, null);
    assert.equal(readInputFontSize(file), null);
    assert.throws(() => writeInputFontSize(file, 5), TypeError);
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ["editor-input.json"]);
});
