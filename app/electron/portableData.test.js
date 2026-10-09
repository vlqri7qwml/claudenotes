const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {resolveDataRoot, resolveInstallDir, toSiyuanOpenURL} = require("./portableData");

const writableAll = () => true;
const writableNone = () => false;

test("Windows 与 Linux 便携数据目录位于可执行文件旁", () => {
    const root = resolveDataRoot({
        platform: "win32",
        execPath: path.join("D:", "Apps", "ClaudeNotes", "ClaudeNotes.exe"),
        env: {},
        appDataPath: path.join("C:", "Users", "me", "AppData", "Roaming"),
        appPath: "",
        isPackaged: true,
        writable: writableAll,
    });
    assert.equal(root.portable, true);
    assert.equal(root.root, path.join("D:", "Apps", "ClaudeNotes", "ClaudeNotesData"));
    assert.equal(root.confDir, path.join(root.root, "config"));
    assert.equal(root.workspaceDir, path.join(root.root, "workspace"));
    assert.equal(root.electronDir, path.join(root.root, "electron"));
    assert.equal(root.tempDir, path.join(root.root, "tmp"));
});

test("AppImage 数据目录位于 .AppImage 文件旁", () => {
    assert.equal(resolveInstallDir({
        platform: "linux",
        execPath: "/tmp/.mount_ClaudeX/claudenotes",
        env: {APPIMAGE: "/home/me/Apps/ClaudeNotes-3.8.6-linux.AppImage"},
    }), "/home/me/Apps");
});

test("macOS 数据目录位于 .app 旁，被系统隔离运行时回退到应用数据目录", () => {
    assert.equal(resolveInstallDir({
        platform: "darwin",
        execPath: "/Users/me/Apps/ClaudeNotes.app/Contents/MacOS/ClaudeNotes",
        env: {},
    }), "/Users/me/Apps");
    const translocated = resolveDataRoot({
        platform: "darwin",
        execPath: "/private/var/folders/x/AppTranslocation/ABC/d/ClaudeNotes.app/Contents/MacOS/ClaudeNotes",
        env: {},
        appDataPath: "/Users/me/Library/Application Support",
        appPath: "",
        isPackaged: true,
        writable: writableAll,
    });
    assert.equal(translocated.portable, false);
    assert.equal(translocated.root, path.join("/Users/me/Library/Application Support", "ClaudeNotes"));
});

test("安装目录不可写时回退到系统应用数据目录", () => {
    const root = resolveDataRoot({
        platform: "linux",
        execPath: "/opt/ClaudeNotes/claudenotes",
        env: {},
        appDataPath: "/home/me/.config",
        appPath: "",
        isPackaged: true,
        writable: dir => !dir.startsWith("/opt/"),
    });
    assert.equal(root.portable, false);
    assert.equal(root.root, path.join("/home/me/.config", "ClaudeNotes"));
});

test("环境变量 CLAUDENOTES_DATA_DIR 优先，开发环境使用 app 同级目录", () => {
    assert.equal(resolveDataRoot({
        platform: "linux",
        execPath: "/opt/ClaudeNotes/claudenotes",
        env: {CLAUDENOTES_DATA_DIR: "/data/notes"},
        appDataPath: "/home/me/.config",
        appPath: "",
        isPackaged: true,
        writable: writableAll,
    }).root, path.resolve("/data/notes"));
    assert.equal(resolveDataRoot({
        platform: "linux",
        execPath: "/repo/app/node_modules/electron/dist/electron",
        env: {},
        appDataPath: "/home/me/.config",
        appPath: "/repo/app/electron",
        isPackaged: false,
        writable: writableNone,
    }).root, path.join("/home/me/.config", "ClaudeNotes"));
});

test("claudenotes:// 链接转换为内部的 siyuan:// 地址", () => {
    assert.equal(toSiyuanOpenURL("claudenotes://blocks/20260101000000-abcdefg"), "siyuan://blocks/20260101000000-abcdefg");
    assert.equal(toSiyuanOpenURL("siyuan://blocks/x"), "siyuan://blocks/x");
    assert.equal(toSiyuanOpenURL("--workspace=/x"), "");
    assert.equal(toSiyuanOpenURL(undefined), "");
});
