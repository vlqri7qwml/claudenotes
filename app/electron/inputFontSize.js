const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// 与编辑器字号的取值范围一致（app/src/constants.ts 的 EDITOR_FONT_SIZE_MIN / MAX）
const INPUT_FONT_SIZE_MIN = 9;
const INPUT_FONT_SIZE_MAX = 72;

// 新输入字号是整数像素值，null 表示跟随编辑器字号
const normalizeInputFontSize = (value) => {
    return Number.isInteger(value) && value >= INPUT_FONT_SIZE_MIN && value <= INPUT_FONT_SIZE_MAX ? value : null;
};

const readInputFontSize = (file) => {
    try {
        return normalizeInputFontSize(JSON.parse(fs.readFileSync(file, "utf8"))?.fontSize);
    } catch (error) {
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
};

const writeInputFontSize = (file, fontSize) => {
    if (fontSize !== null && normalizeInputFontSize(fontSize) === null) {
        throw new TypeError("Invalid input font size");
    }
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const temporary = file + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
    try {
        fs.writeFileSync(temporary, JSON.stringify({fontSize}), {mode: 0o600});
        fs.renameSync(temporary, file);
    } finally {
        if (fs.existsSync(temporary)) {
            fs.unlinkSync(temporary);
        }
    }
};

module.exports = {normalizeInputFontSize, readInputFontSize, writeInputFontSize};
