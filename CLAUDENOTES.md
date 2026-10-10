# ClaudeNotes

ClaudeNotes 是在思源笔记 v3.8.6 源码（本仓库，对应官方提交 `fb3355f`）基础上修改的本地笔记软件：界面采用 claude.ai 的风格（配色最初参考 `.ai` 项目），内置 AI 对话的粘贴与导入，数据默认全部放在安装目录，并且可以一键关闭思源官方的云端服务。源码固定在本仓库中，不依赖官方后续版本，任何历史版本都可以从本仓库的标签和 Releases 重新获取。

## 与官方思源的区别

| 项目 | 官方思源 | ClaudeNotes |
| --- | --- | --- |
| 应用名 / 应用 ID | SiYuan / `org.b3log.siyuan` | ClaudeNotes / `io.github.vlqri7qwml.claudenotes` |
| 内核程序 | `SiYuan-Kernel` | `ClaudeNotes-Kernel` |
| 内核固定端口 | 6806 | 6826 |
| 链接协议 | `siyuan://` | `claudenotes://`（文档内的 `siyuan://blocks/...` 链接照常可用） |
| 用户级配置目录 | `~/.config/siyuan` | `<安装目录>/ClaudeNotesData/config` |
| 默认工作空间 | `~/SiYuan` | `<安装目录>/ClaudeNotesData/workspace` |
| Electron 数据、日志、缓存 | 系统应用数据目录 | `<安装目录>/ClaudeNotesData/electron` |
| 云端服务（账号、云同步、集市、更新检查、公告、云端收集箱、模型目录） | 始终开启 | 默认关闭，可在 设置 - 账号与同步 或主菜单中开启 |
| 界面风格 | 默认主题 | 内置明亮 / 暗黑主题改为 claude.ai 风格（暖色背景、`#D97757` 强调色、衬线正文、居中一栏、回答排版与 claude.ai 一致）；第三方主题不受影响 |
| 窗口外围 | 无 | Windows 主窗口四周有一圈 10px 留白，任何时候都能按住拖动窗口（页签再多也不受影响）；最大化时保留，全屏时去掉 |
| AI 对话 | 无 | 粘贴识别、块菜单「对话样式」、导入聊天记录 |
| 自动下载更新安装包 | 支持 | 不提供（官方安装包是另一个软件，安装后不会升级 ClaudeNotes） |

由于身份完全独立，ClaudeNotes 与官方思源可以同时安装、同时运行，互不读写对方的配置。

## 数据放在哪里

启动时按以下顺序确定数据根目录 `ClaudeNotesData`：

1. 环境变量 `CLAUDENOTES_DATA_DIR` 指定的目录
2. 程序所在目录下的 `ClaudeNotesData`（Windows 为安装目录，Linux AppImage 为 `.AppImage` 文件所在目录，macOS 为 `.app` 所在目录）
3. 上述目录不可写，或 macOS 以隔离方式运行（从「下载」直接打开未移动的 `.app`）时，退回系统应用数据目录下的 `ClaudeNotes`

`ClaudeNotesData` 的结构：

| 路径 | 内容 |
| --- | --- |
| `config/` | 工作空间列表 `workspace.json`、内核端口 `port.json`、`cookie.key`、窗口状态、内核与应用日志 |
| `workspace/` | 默认工作空间（可在 主菜单 - 工作空间 中新建或打开其他目录） |
| `electron/` | Electron 用户数据、会话、日志、崩溃转储；Linux 下还包括证书库与缓存 |
| `tmp/` | 仅 Windows：临时文件（避免写入 C 盘） |

Windows 安装版卸载或升级时只删除程序文件，`ClaudeNotesData` 默认保留；卸载时会询问是否一并删除。免安装版（zip）解压到任意目录即可使用。整体迁移或备份时复制整个 `ClaudeNotesData` 即可。

目录之外仍会出现的内容：macOS 与 Linux 的系统临时目录（Chromium 单实例锁，退出后清除）；Linux 显卡驱动的着色器缓存（`~/.cache/mesa_shader_cache`，由系统驱动管理，与笔记无关）。

## 存储格式

ClaudeNotes 与官方思源使用完全相同的工作空间格式，没有修改 `.sy` 文件格式和数据规范版本（`CurrentSpec` 为 `"5"`）。

| 路径（工作空间内） | 内容 | 能否删除重建 |
| --- | --- | --- |
| `data/<笔记本 ID>/` | 笔记本，`.siyuan/conf.json` 为笔记本配置，`.siyuan/sort.json` 为文档排序 | 否，笔记本体 |
| `data/<笔记本 ID>/**/<文档 ID>.sy` | 文档：JSON 格式的块树，根节点 `Spec` 字段记录数据规范版本；子文档放在与父文档 ID 同名的文件夹中 | 否，笔记本体 |
| `data/assets/` | 图片、附件等资源 | 否 |
| `data/storage/` | 数据库（`av/`）、闪卡（`riff/`）、插件数据（`petal/`）、界面偏好 `local.json` 等 | 否 |
| `data/templates/` `data/widgets/` `data/plugins/` `data/snippets/` `data/emojis/` `data/public/` | 模板、挂件、插件、代码片段、自定义表情、公开资源 | 否 |
| `conf/conf.json` | 工作空间设置（外观、编辑器、同步等） | 否 |
| `temp/` | 搜索与引用索引 `siyuan.db`、`blocktree.db`、`history.db`、`asset_content.db` 等 | 是，可在 设置 - 应用 - 重建索引 中重建 |
| `history/` | 文件历史 | 可清理 |
| `repo/` | 数据快照（加密的增量仓库，用于数据历史和同步） | 可清理，但会丢失快照 |

ClaudeNotes 新增的数据都使用思源原有的扩展点，官方思源会原样保留：

- 对话块：超级块上的块属性 `custom-sy-chat-role`（`user` / `assistant` / `thinking`）与 `custom-sy-chat-source`（`claude`、`chatgpt`、`gemini`、`deepseek`、`kimi`、`doubao`、`generic`）
- 导入的对话文档：文档属性 `custom-sy-chat-id`（用于重复导入时去重）、`custom-sy-chat-source`、`custom-sy-chat-created`
- `conf/conf.json` 中 `system.cloudService`（云端服务开关，默认 `false`）
- `data/storage/local.json` 中 `local-ai-chat-paste`（粘贴时识别 AI 对话）与 `local-ai-chat-thinking`（保留思考过程）

### 与官方思源互相打开

- 官方思源打开 ClaudeNotes 的工作空间：可以，对话块显示为普通超级块，其余内容一致
- ClaudeNotes 打开官方思源的工作空间：可以（已用官方 v3.8.6 创建的工作空间验证），只要该工作空间的数据规范版本不高于 ClaudeNotes 所基于的版本；官方新版本若提升了 `Spec`，较旧的程序会拒绝打开并提示升级
- 同一个工作空间不能同时被两个程序打开（工作空间中的 `.lock` 会阻止第二个程序）
- 备份：数据快照（主菜单 - 数据历史 - 数据快照）在本地即可使用；思源的同步（官方云端、S3、WebDAV、本地文件夹）都要求登录付费的思源账号，登录需要开启云端服务

## 排版与字号

- 正文默认居中显示（关闭「自适应宽度」），代码块默认自动换行。每个工作空间第一次被新版本打开时自动设置一次，之后可在 设置 - 外观 - 自适应宽度、设置 - 编辑器 - 代码块换行 中改回
- 内置明亮 / 暗黑主题下，标题、列表、表格、代码块、引用块、链接的样式与 claude.ai 网页的回答一致。表格是圆角细框、浅灰表头、行间浅色横线，单词不会从中间拆开
- 新输入字号：顶栏「A」按钮，设置之后新起的段落和从外部粘贴进来的段落、表格使用的字号；已有文字不变，在旧段落里接着打字跟随旧段落，标题不受影响。字号写进笔记本身（块属性 `style`），设置对所有工作空间生效。选「跟随编辑器字号」恢复思源原样

## AI 对话

- 粘贴：从 Claude、ChatGPT、Gemini、DeepSeek、Kimi、豆包网页复制的对话，或带「User: / Assistant:」等说话人标签的文本，粘贴后每一轮生成一个对话块；在代码块、表格内粘贴以及「粘贴并保留源格式」不受影响。可在 设置 - 编辑器 - AI 对话 中关闭
- claude.ai 拖选复制时只往剪贴板放纯文本，粘贴后没有列表、代码块等格式；要保留格式，请用回答下方的「复制」按钮（得到 Markdown）
- 排查粘贴问题：设置 - 编辑器 - AI 对话 - 导出最近一次粘贴内容，把最近一次粘贴的原始剪贴板内容和处理方式保存为 JSON（只保存在内存中，重启后清空）
- 块菜单：对话样式 - 设为提问 / 设为回答 / 设为思考过程 / 取消对话样式，支持撤销
- 导入：笔记本或文档右键 导入 - AI 聊天记录（导入到该位置），或 主菜单 - 导入聊天记录（选择笔记本，默认「AI 对话」）。支持 Claude / ChatGPT / DeepSeek 官方导出（`.zip` 或 `conversations.json`）、通用 JSON、Markdown、TXT 以及网页另存为的 HTML；每个对话一篇文档，路径为 `<导入位置>/<来源>/<标题>`

代码位于 `app/src/aiChat/`，样式位于 `app/src/assets/scss/protyle/_ai_chat.scss` 与 `app/src/assets/scss/business/_ai_chat_import.scss`。

## 构建

需要：Go（版本见 `kernel/go.mod`）、Node.js 24 与 pnpm（版本见 `app/package.json` 的 `packageManager`）、C 编译器（内核使用 CGO）。

Windows 上必须先安装 64 位 MinGW-w64 的 gcc（例如 MSYS2 的 `mingw-w64-ucrt-x86_64-gcc`，并把其 `bin` 目录加入 PATH），编译前设置 `CGO_ENABLED=1`。没有 gcc 时 Go 会自动关闭 CGO，编译报 `undefined: loadPlatformFonts` 之类的错误。

```bash
cd app
pnpm install
pnpm run build

cd ../kernel
# Linux；macOS 输出到 ../app/kernel-darwin 或 ../app/kernel-darwin-arm64；Windows 输出到 ../app/kernel/ClaudeNotes-Kernel.exe
go build -tags "fts5 sqlcipher" -ldflags "-s -w -X github.com/siyuan-note/siyuan/kernel/util.Mode=prod" -o ../app/kernel-linux/ClaudeNotes-Kernel .

cd ../app
pnpm exec electron-builder --linux --config electron-builder-linux.yml --publish=never
# Windows：pnpm exec electron-builder --win --config electron-builder.yml --publish=never
# macOS：pnpm exec electron-builder --mac --config electron-builder-darwin-arm64.yml --publish=never
```

安装包输出到 `app/build/`。开发调试时可以直接运行内核 `ClaudeNotes-Kernel serve --wd=<app 目录> --workspace=<工作空间>`，用浏览器打开 `http://127.0.0.1:<端口>/stage/build/desktop/`。

## 发布

在本仓库推送标签 `claudenotes-v<版本号>`（版本号与 `app/package.json` 一致，可附加后缀，例如 `claudenotes-v3.8.6` 或 `claudenotes-v3.8.6-2`），GitHub Actions 中的 `ClaudeNotes Release`（`.github/workflows/claudenotes.yml`）会运行测试、构建 Windows（安装版与免安装 zip）、macOS（Apple 芯片与 Intel）、Linux（AppImage、deb、tar.gz）安装包，并在 Windows 上自动检查「安装 - 首次启动 - 卸载后 `ClaudeNotesData` 仍保留」，最后发布到 Releases。也可以在 Actions 页面手动运行，只构建不发布。

安装包没有代码签名：Windows 首次运行会出现 SmartScreen 提示，macOS 需要在 系统设置 - 隐私与安全性 中允许打开。

## 测试

手动测试清单见 [TESTING.md](TESTING.md)。自动测试：`app/` 下 `pnpm test`（Electron 相关用例需要图形环境），`kernel/` 下 `go test -tags "fts5 sqlcipher" ./...`。

## 许可

- 本仓库（ClaudeNotes 的全部源码）沿用思源笔记的 AGPL-3.0 许可。分发安装包时必须同时提供对应的完整源码（例如保持本仓库公开，并在发布说明中注明源码位置），保留原有版权声明
- 界面风格参考的 `.ai` 项目（仓库 `vlqri7qwml/.ai`）使用其自身的非商业许可；本仓库只借用了它的配色与字体风格，没有包含它的代码
- 内置字体 Source Serif 4（正文英文）使用 SIL Open Font License 1.1，许可证见 `app/appearance/fonts/SourceSerif4/LICENSE`；界面和中文使用系统字体
- 「Claude」是 Anthropic 的商标，公开分发前建议确认软件名称的使用是否合适
