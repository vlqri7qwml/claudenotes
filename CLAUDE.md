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
- 粘贴丢格式已查清：claude.ai（含 Claude Code 网页版）**拖选复制时只往剪贴板放纯文本**（用户在 Windows 的 Chrome 上抓到 `types: ["text/plain"]`，样例已按用户要求删除），格式信息本来就不存在；用回答下方的「复制」按钮（得到 Markdown）格式正常。粘贴代码没有问题，不要为这件事改粘贴逻辑
- 最近一轮已改：
  - 行内代码红字灰底，配色取自 `.ai` 仓库 `src/index.css` 的 `.inline-code`
  - 字体回退：正文英文 Source Serif 4（用户说的「Anthropic Serif」指的就是改动前的这个字体），中文微软雅黑（系统字体），界面用系统字体；删除 Figtree
  - 代码块默认自动换行：`kernel/conf/editor.go`，只影响新建的工作空间
  - 设置 - 编辑器 - AI 对话 新增「导出最近一次粘贴内容」：`app/src/aiChat/pasteDebug.ts`，在 `paste.ts` 各分支记录走了哪条路径
- 已知问题见下面的「后续目标」

## 后续目标（按优先级）

### 1. 窗口拖不动（最优先）

用户反馈（Windows）：构建已包含 `5fa3e90`（边框改描边），窗口仍然拖不动。只读排查的结论：

- 默认开启「页签融合至顶栏」（`HideToolbar: true`），这时能拖动的只有三小块：
  - `#drag::before` / `::after` 两条细条，默认 8px，左侧栏打开时左条会加宽
  - 页签栏「+」和「∨」之间的空白，由 `app/src/layout/tabUtil.ts` 的 `setTabPosition` 设置；页签多了会缩到接近 0
- 这套逻辑和思源官方一样。ClaudeNotes 把整条顶栏涂成同一个颜色，看起来整条都是标题栏，用户容易在拖不动的地方拖
- 已排除：
  - 描边改法本身
  - Electron 窗口参数（和官方一样）
  - `style.WebkitAppRegion` 写法（在 Chromium 141 里实测有效）
- 注意：新版 Chromium 把 `-webkit-app-region: none` 计算成 `no-drag`
- 下一步：等用户在 Windows 开发者工具的控制台跑诊断代码（红色是可拖动区域，蓝色是不可拖动区域），上传 `drag.json` 和截图，并说明在红色区域能不能拖：
  - 能拖：把页签栏的整块空白设成可拖动，页签、按钮和弹出层设成 `no-drag`
  - 也拖不动：查全屏状态、Windows 缩放等窗口层面的原因

### 2. 其他待办

- 「误认成对话」：没有站点标记时，程序会在纯文本里找「问：答：user: assistant:」这类标签，普通回答也可能被当成对话（容器里复现过 3 例）。用户这一轮选择暂时不修
- 发布工作流 `.github/workflows/claudenotes.yml` 还没真正跑过，修完拖动后手动运行一次，让用户拿到新安装包
- `.ai` 仓库的旧分支 `claude/affectionate-albattani-iuwc6w` 等用户确认后再删
- Windows 安装包未签名，首次运行会出现 SmartScreen 提示
- 插件时代留下的 `custom-chat-role` 属性没有样式（现在用 `custom-sy-chat-role`）

## 代码索引

| 功能 | 位置 |
| --- | --- |
| AI 对话核心 | `app/src/aiChat/`：`paste.ts`（`getAIChatPasteBlockDOM`）、`parse/{html,text,detect,files}.ts`、`render.ts`、`pasteDebug.ts`（导出最近一次粘贴）、`importer.ts`、`dialog.ts`、`preference.ts`、`types.ts` |
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
