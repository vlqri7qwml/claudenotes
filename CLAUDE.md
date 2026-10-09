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
8. **用户只用 Windows 版**。回复、方案、测试步骤、构建命令一律按 Windows 写（路径用 `D:\...`、命令用 cmd / PowerShell）。不要拿 Linux / macOS 的情况当结论，也不要在回复里提它们。云端会话的容器是 Linux，只能用来跑测试和初步复现；容器里正常不代表 Windows 上正常，最终以用户在 Windows 上的结果为准，需要时请用户在 Windows 上操作并反馈。

## 与 AGENTS.md 的关系

`AGENTS.md` 是思源官方给 AI 的规则，代码风格、i18n、API 契约等约定继续遵守。以下几条在本仓库**不适用**：

- 可以运行 `pnpm run build`、打包和提交，前提是用户已同意动手（见上面的协作规则）
- 提交信息用普通英文句子，不用 gitmoji；末尾附会话要求的署名行
- petal / 插件 API 同步、`gh` CLI、官方发版流程不适用

## 当前状态（2026-10-09）

- 已完成：独立身份（ClaudeNotes、端口 6826、`claudenotes://`）、安装目录便携数据、云端服务开关（默认关）、claude.ai 风格内置主题、AI 对话粘贴 / 块菜单 / 导入、Windows 安装包保留数据、三平台发布工作流
- 最近修复：顶栏窗口拖动失效（边框改为描边）；同一次把正文改成了无衬线，用户不认可，见后续目标 2
- 已知问题见下面的「后续目标」

## 后续目标（按优先级）

### 1. 粘贴丢格式（最优先）

用户反馈（Windows，2026-10-09）：claude.ai 聊天和 Claude Code 网页版都一样，**拖选后 Ctrl+C、Ctrl+V**，结果：

- 列表、段落等结构丢失，像纯文本
- 行内代码没有 claude.ai 那种「红字灰底」
- 代码块 / 命令行没有圆角方框

云端容器里用仿 claude.ai 页面模拟复制粘贴是正常的，但那不是用户的环境，要在用户的 Windows 上找原因。方向：

- 先确认用户装的是哪次构建，是否包含最新的 `app/src/aiChat/` 代码（发布工作流还没跑过）
- 加一个调试手段（例如 设置 - 编辑器 - AI 对话 里的「导出最近一次粘贴的剪贴板内容」，或在开发者工具控制台打印），拿到 Windows 上真实的 `text/html` 和 `text/plain`，用它们做测试用例放进 `app/src/aiChat/fixtures/`
- 对照 `app/src/protyle/util/paste.ts` 和 `app/src/aiChat/paste.ts`，确认这份 HTML 走的是哪条路径（是否被误判成对话后按纯文本解析、是否落到了只用 `text/plain` 的分支）
- 修好后：行内代码显示为红字灰底小圆角，代码块是带圆角边框的方框，与 claude.ai 一致

### 2. 字体

用户要求：**只要 Anthropic Serif 和系统默认字体**，其他字体可以移除。上一轮把正文改成了无衬线，这是错的，要改回来。

- 对照 claude.ai：回答正文用 Anthropic Serif，界面、提问用系统默认无衬线字体，代码用系统等宽字体
- Anthropic Serif 是 Anthropic 的专有字体，**不能随安装包分发**，动手前先和用户确认：只在 CSS 里写 `"Anthropic Serif"`（用户电脑装了就用，没装回退到系统衬线字体），还是用户自己提供字体文件
- `app/appearance/fonts/` 现有 Figtree（本项目加的，可删）、JetBrainsMono、LxgwWenKaiGB-Lite、Noto-COLRv1（思源原有）。删除前先搜索引用；Noto-COLRv1 是表情符号字体，删掉可能导致表情显示异常，需要告诉用户再决定
- 相关文件：`app/appearance/themes/{daylight,midnight}/theme.css`（`--b3-font-family*`）、`app/src/assets/scss/business/_claudenotes.scss`、`app/src/assets/scss/protyle/_ai_chat.scss`、CLAUDENOTES.md 的字体与许可说明

### 3. 其他待办

- 发布工作流 `.github/workflows/claudenotes.yml` 还没真正跑过，修完上面两项后手动运行一次，让用户拿到新安装包
- `.ai` 仓库的旧分支 `claude/affectionate-albattani-iuwc6w` 等用户确认后再删
- Windows 安装包未签名，首次运行会出现 SmartScreen 提示
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

## 构建与测试（Windows）

准备：Go（版本见 `kernel/go.mod`）、Node.js 24、pnpm、MinGW-w64 的 gcc（内核必须开 CGO，没有 gcc 会报 `undefined: loadPlatformFonts`）。

一键构建安装包（在仓库根目录的 cmd 中）：

```bat
scripts\win-build.bat --target=amd64
```

分步构建（cmd；PowerShell 中把 `set CGO_ENABLED=1` 换成 `$env:CGO_ENABLED=1`）：

```bat
cd app
pnpm install
pnpm run build
cd ..\kernel
set CGO_ENABLED=1
go build -tags "fts5 sqlcipher" -ldflags "-s -w -X github.com/siyuan-note/siyuan/kernel/util.Mode=prod" -o ..\app\kernel\ClaudeNotes-Kernel.exe .
cd ..\app
pnpm exec electron-builder --win --config electron-builder.yml --publish=never
```

安装包输出到 `app\build\`。也可以在 GitHub 的 Actions 页面手动运行 `ClaudeNotes Release`，下载产物里的 Windows 安装包。

测试（在 `app` 目录）：

```bat
pnpm run typecheck
pnpm exec eslint .
node --import tsx --test --test-concurrency=1 src/aiChat/aiChat.test.ts electron/portableData.test.js "src/config/entryVisibility/*.test.ts"
```

内核测试（在 `kernel` 目录）：`go test -tags "fts5 sqlcipher" ./util ./bazaar ./agent ./conf ./apicontract -count=1`。

调试：运行 `ClaudeNotes-Kernel.exe serve --wd=<app 目录> --workspace=<工作空间>`，浏览器打开 `http://127.0.0.1:<端口>/stage/build/desktop/`；桌面版的开发者工具在 主菜单 - 开发者工具（菜单项 id `debug`）。

## 关于 `.ai` 仓库

`vlqri7qwml/.ai`（私有，需在会话中单独挂载）只在需要参考**仿 claude.ai 页面**时查看：

- 除 `siyuan-master/` 以外的代码都是仿 claude.ai 的前端页面，可以参考配色、布局和组件样式
- `help.txt`、`matches.txt`、`refactor.js`、`refactor.cjs`、`noop.cjs` 是零散遗留文件，不用看
- **`.ai/siyuan-master/` 和 `.ai` 的开发分支 `claude/affectionate-albattani-iuwc6w` 都是旧版本**，ClaudeNotes 的源码一律以本仓库为准，不要从那里拷代码回来
