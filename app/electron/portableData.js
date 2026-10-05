// ClaudeNotes 数据根目录：配置、默认工作空间、Electron 数据和临时文件都放在安装目录下的 ClaudeNotesData，
// 不写入用户家目录；安装目录不可写时回退到系统应用数据目录。
const fs = require("fs");
const path = require("path");

const DATA_DIR_NAME = "ClaudeNotesData";
const FALLBACK_DIR_NAME = "ClaudeNotes";

const isWritableDir = (dir) => {
    try {
        fs.mkdirSync(dir, {recursive: true});
        const probe = path.join(dir, `.write-test-${process.pid}`);
        fs.writeFileSync(probe, "");
        fs.unlinkSync(probe);
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * 计算安装目录（数据根目录的父目录）。
 * Windows / Linux 取可执行文件所在目录，AppImage 取 .AppImage 文件所在目录，macOS 取 .app 所在目录。
 * macOS 未签名应用被系统隔离运行（App Translocation）时路径只读，返回空字符串。
 */
const resolveInstallDir = ({platform, execPath, env}) => {
    if ("linux" === platform && env.APPIMAGE) {
        return path.dirname(env.APPIMAGE);
    }
    if ("darwin" === platform) {
        const appBundle = execPath.split(path.sep).findIndex(item => item.endsWith(".app"));
        if (-1 === appBundle || execPath.includes("/AppTranslocation/")) {
            return "";
        }
        return execPath.split(path.sep).slice(0, appBundle).join(path.sep) || path.sep;
    }
    return path.dirname(execPath);
};

/**
 * 返回数据根目录及各子目录。
 * 优先级：环境变量 CLAUDENOTES_DATA_DIR > 开发环境的 app/ClaudeNotesData-dev > 安装目录/ClaudeNotesData > 系统应用数据目录。
 */
const resolveDataRoot = ({platform, execPath, env, appDataPath, appPath, isPackaged, writable = isWritableDir}) => {
    let root = "";
    let portable = true;
    if (env.CLAUDENOTES_DATA_DIR) {
        root = path.resolve(env.CLAUDENOTES_DATA_DIR);
    } else if (!isPackaged) {
        root = path.join(path.dirname(appPath), DATA_DIR_NAME + "-dev");
    } else {
        const installDir = resolveInstallDir({platform, execPath, env});
        if (installDir) {
            root = path.join(installDir, DATA_DIR_NAME);
        }
    }
    if (!root || !writable(root)) {
        root = path.join(appDataPath, FALLBACK_DIR_NAME);
        portable = false;
    }
    return {
        root,
        portable,
        confDir: path.join(root, "config"),
        workspaceDir: path.join(root, "workspace"),
        electronDir: path.join(root, "electron"),
        tempDir: path.join(root, "tmp"),
    };
};

/**
 * ClaudeNotes 向系统注册 claudenotes:// 协议，内部仍按 siyuan:// 处理块链接等地址。
 * 返回转换后的 siyuan:// 地址，参数不是协议链接时返回空字符串。
 */
const toSiyuanOpenURL = (arg) => {
    if (typeof arg !== "string") {
        return "";
    }
    if (arg.startsWith("claudenotes://")) {
        return "siyuan://" + arg.slice("claudenotes://".length);
    }
    return arg.startsWith("siyuan://") ? arg : "";
};

module.exports = {DATA_DIR_NAME, resolveDataRoot, resolveInstallDir, toSiyuanOpenURL};
