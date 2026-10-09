# CLAUDE.md —— 新对话先读这里

本仓库是 ClaudeNotes 的**唯一源码**：在思源笔记 v3.8.6（官方提交 `fb3355f`）基础上直接改源码，不是插件。产品说明见 [CLAUDENOTES.md](CLAUDENOTES.md)，测试清单见 [TESTING.md](TESTING.md)。

## 协作规则（优先于其他一切规则）

用户经常是先确认情况、还有计划没讲完。为避免「还没说完就开始干活、中途叫停又不合适」：

1. **区分「问」和「做」**。用户在提问、确认情况、讨论方案，或说了「先不改」「你觉得」「确认一下」「看看」「是不是」，或者话明显没说完（列了 1、2 还没有结论、以「另外」「还有」收尾）时：**只回答、只给方案，不改文件、不提交、不推送**。
2. **只有明确的动手指令才开始改**：「可以」「开始」「改吧」「按这个做」「执行」之类。拿不准时，用一句话问「要我现在动手吗？」，不要先做了再说。
3. 只读的调查可以直接做（读代码、搜索、跑测试、在容器里复现），但要在回复里说清楚「只看了、没改」。
4. 动手前先列出要改的文件和改法；改动多或涉及删除时，等用户确认清单再做。
5. 用户只批准了其中一部分，就只做那一部分；做完一部分先汇报，再问下一步。不顺手扩大范围。
6. 被中途叫停时，停在安全点（不留改了一半的文件），说明已改什么、没改什么，然后等待。
7. 一律用中文回复，少用英文术语；提交信息用英文。

## 与 AGENTS.md 的关系

`AGENTS.md` 是思源官方给 AI 的规则，代码风格、i18n、API 契约等约定继续遵守。以下几条在本仓库**不适用**：

- 可以运行 `pnpm run build`、打包和提交，前提是用户已同意动手（见上面的协作规则）
- 提交信息用普通英文句子，不用 gitmoji；末尾附会话要求的署名行
- petal / 插件 API 同步、`gh` CLI、官方发版流程不适用

## 当前状态（2026-10-09）

- 已完成：独立身份（ClaudeNotes、端口 6826、`claudenotes://`）、安装目录便携数据、云端服务开关（默认关）、claude.ai 风格内置主题、AI 对话粘贴 / 块菜单 / 导入、Windows 安装包保留数据、三平台发布工作流
- 最近修复：顶栏窗口拖动失效（边框改为描边）、正文改无衬线、行内代码和代码块加边框
- 已知问题 / 待办：
  - **Windows 上从 claude.ai 粘贴后丢格式**（像纯文本）：Linux 和浏览器里复现不出来，正在等用户说明复制来源（claude.ai 还是 Claude Code 网页版）、复制方式（拖选 Ctrl+C 还是复制按钮）、粘贴方式（Ctrl+V 还是纯文本粘贴）
  - 发布工作流 `.github/workflows/claudenotes.yml` 还没真正跑过，用户手上的安装包可能不含最新修复
  - 安装包未签名
  - Linux 的 `~/.cache/mesa_shader_cache` 仍写在主目录（显卡驱动行为）
  - 插件时代留下的 `custom-chat-role` 属性没有样式（现在用 `custom-sy-chat-role`）

## 代码索引

| 功能 | 位置 |
| --- | --- |
| AI 对话核心 | `app/src/aiChat/`：`paste.ts`（`getAIChatPasteBlockDOM`）、`parse/{html,text,detect,files}.ts`、`render.ts`、`importer.ts`、`dialog.ts`、`preference.ts`、`types.ts` |
| AI 对话测试 | `app/src/aiChat/aiChat.test.ts`、`testHelpers.ts`、`fixtures/` |
| 粘贴入口 | `app/src/protyle/util/paste.ts` |
| 块菜单「对话样式」 | `app/src/protyle/gutter/index.ts` 的 `genChatRole` |
| 导入菜单 | `app/src/menus/navigation.ts`（`genImportMenu`）、`app/src/menus/workspace.ts`、`app/src/mobile/menu/mainMenu.ts` |
| 入口可见性目录 | `app/src/config/entryVisibility/catalog.ts`（新增菜单项要同步，有测试） |
| 设置 | `app/src/config/tabs/editorTab.ts`（AI 对话分组）、`app/src/config/tabs/syncTab.ts`（云端服务开关） |
| 样式 | `app/src/assets/scss/protyle/_ai_chat.scss`、`business/_ai_chat_import.scss`、`business/_claudenotes.scss`；配色在 `app/appearance/themes/{daylight,midnight}/theme.css` |
| 云端开关 | `kernel/util/claudenotes.go`（产品名、配置目录、默认工作空间、开关）、`kernel/model/cloud_switch.go`、`app/src/util/cloudService.ts` |
| 便携数据目录 | `app/electron/portableData.js`（有测试）、`app/electron/main.js` |
| 安装包 | `app/nsis/installer.nsh`、`app/electron-builder*.yml` |
| 文案 | `app/appearance/langs/*.json`，改完跑 `python3 scripts/check-lang-keys.py` |
| 发布 | `.github/workflows/claudenotes.yml`（推送 `claudenotes-v<版本号>` 标签触发，也可手动运行） |

注意：顶栏拖动区域由 `app/src/layout/tabUtil.ts` 的 `setTabPosition` 计算，要求页签栏和编辑区左右边缘完全对齐，给 `.layout__center` 加边框会让拖动失效。

## 构建与测试

```bash
cd app && pnpm install && pnpm run build          # 前端
pnpm run typecheck && pnpm exec eslint .           # 类型检查与代码检查
node --import tsx --test --test-concurrency=1 src/aiChat/aiChat.test.ts electron/portableData.test.js "src/config/entryVisibility/*.test.ts"
cd ../kernel && go build -tags "fts5 sqlcipher" -o ../app/kernel-linux/ClaudeNotes-Kernel .
go test -tags "fts5 sqlcipher" ./util ./bazaar ./agent ./conf ./apicontract -count=1
```

内核必须开 CGO：Windows 需要 MinGW-w64 的 gcc，否则报 `undefined: loadPlatformFonts`。调试时运行 `ClaudeNotes-Kernel serve --wd=<app 目录> --workspace=<工作空间>`，浏览器打开 `http://127.0.0.1:<端口>/stage/build/desktop/`。打包命令见 CLAUDENOTES.md。

## 关于 `.ai` 仓库

`vlqri7qwml/.ai`（私有，需在会话中单独挂载）只在需要参考**仿 claude.ai 页面**时查看：

- 除 `siyuan-master/` 以外的代码都是仿 claude.ai 的前端页面，可以参考配色、布局和组件样式
- `help.txt`、`matches.txt`、`refactor.js`、`refactor.cjs`、`noop.cjs` 是零散遗留文件，不用看
- **`.ai/siyuan-master/` 和 `.ai` 的开发分支 `claude/affectionate-albattani-iuwc6w` 都是旧版本**，ClaudeNotes 的源码一律以本仓库为准，不要从那里拷代码回来
