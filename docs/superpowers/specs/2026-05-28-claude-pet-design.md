# claude-pet — Claude Code 桌面电子宠物插件 · 设计文档

- 日期: 2026-05-28
- 状态: 已通过 brainstorming,待用户复核后进入 writing-plans

## 1. 目标

做一个可安装的 Claude Code 插件,提供一只**桌面悬浮窗电子宠物**:

- 它是一只屏幕上漂浮的桌面宠物(类似 Shimeji),不是终端状态栏里的字符。
- 领养时用户从**几种常见宠物里挑一只**(猫/狗/龙/史莱姆等),各有外观。
- 美术由 **GPT Image 2.0 在开发期预生成**并烘焙进插件,终端用户免 key、免联网。
- 它会**成长**:不只看代码行数,而是奖励**有意义的成果**——实现功能、测试通过、发布里程碑给的经验远多于零碎编辑;还有连续天数加成和成就系统。
- 它有**轻养护**机制:有反映近期活跃度的"心情",长时间不写代码会变蔫,重新开工立刻回升,但**永不死亡**。
- 它会**提醒项目状态**:上下文用量、花费/Token、Git 状态、久坐休息。

### 与现有项目的差异(GitHub 调研)

| 项目 | Stars | 做法 | 成长 |
|------|-------|------|------|
| Ido-Levi/claude-code-tamagotchi | 423 | 终端状态栏 + hooks,4 项电子鸡属性衰减,可拦截 Claude 操作 | 只养护,不升级 |
| terryso/ccpet | 64 | 纯状态栏,单一能量值吃 token,有墓地和排行榜 | 吃 token 涨能量,不分等级阶段 |
| 官方 /buddy | 内置 | 斜杠命令,18 物种,静态 | 不成长(社区 issue #41684 在求按 token 进化) |

**本设计填补的空白**:(1) 真正的桌面悬浮窗——现存宠物全活在终端状态栏;(2) 真正的等级/阶段进化;(3) **奖励真实成果**的经验体系,而非单纯吃 token / 数行数;(4) AI 生成的连贯角色美术。

## 2. 不变量(最高优先级):对项目零副作用

这是不可违背的硬约束,贯穿所有组件:

- **宠物只观察、绝不修改你的项目。** hook 脚本只读取信息,从不写入项目目录(`cwd`)、不编辑文件、不跑任何会改动仓库的 git 命令。
- 所有 git 调用都是**只读**子命令:`git status` / `git log` / `git tag` / `git rev-parse`。**绝不**执行 `commit`/`add`/`checkout`/`tag <new>`/`push` 等。
- 插件**唯一**写入的位置是 `~/.claude-pet/`(宠物自己的状态),在任何项目目录之外。
- hook **绝不阻断** Claude 的操作(不使用 PreToolUse 拦截),始终返回成功。
- "检测到测试通过""检测到提交"等全部是被动观察,不触发任何项目侧动作。
- 连 `/pet milestone` 这类命令也只写宠物状态,不碰项目。

实现与测试都要守住这条:状态引擎对项目的副作用必须为零。

## 3. 架构:两段式解耦

Claude Code 没有对外的实时接口,桌面窗口无法直接读取它的状态。通过共享状态文件解耦:

```
Claude Code 会话
  ├─ SessionStart hook ──┐
  ├─ PostToolUse hook ───┤── 只读观察 → 写入 ~/.claude-pet/pet.json    (持久:宠物身份/成长/成就)
  │   (Edit|Write|Bash)   │             写入 ~/.claude-pet/status.json (当前项目状态快照)
  └─ Stop/SessionEnd ────┘            │
                                       │  fs.watch 监听文件变化
                                       ▼
                     桌面悬浮窗 (Electron:透明/无边框/置顶/可拖动)
                     渲染宠物动画 · 心情表情 · 提醒气泡 · 点击展开面板 · 首次领养选物种
                     (只加载本地 PNG,运行期不调任何图像 API)
```

**状态来源选择**:不劫持用户的 `statusLine`(会冲突),改用 hook 驱动。hook 拿不到的数据(上下文%、花费)由 hook 脚本解析 `transcript_path`(JSONL,每条消息含 token 用量,ccusage 同款做法)推算;Git 状态用只读 `git` 命令查。插件自给自足、不改用户配置、对项目零副作用。

## 4. 组件

| 组件 | 技术 | 职责 |
|------|------|------|
| 状态引擎 | Node hook 脚本(只读) | 监听事件 → 识别成果(提交分类/测试通过/里程碑)→ 算经验/等级/心情/成就 → 解析 transcript 拿 token/上下文 → 只读查 git → 写两个 JSON |
| 桌面悬浮窗 | Electron | 首次运行显示**领养选物种**界面;监听 JSON → 渲染动画宠物(本地 PNG)→ 心情/打气表情 → 提醒气泡 → 点击展开面板(等级/经验条/成就/项目状态)→ 本地算闲置衰减 |
| 美术资产管线 | Node 脚本(**仅开发期**,调 OpenAI 图像生成 / GPT Image 2.0) | 按 物种×阶段×表情 批量生成透明 PNG 精灵图,烘焙进插件;终端用户无需 API key |
| 斜杠命令 | `commands/pet.md` | `/pet` 看状态与成就;`/pet adopt <物种>`、`/pet rename`、`/pet milestone "<描述>"`、`/pet start\|stop` |
| 技能 | `skills/claude-pet/SKILL.md` | 让 Claude 懂宠物机制,能回答"我宠物怎么样了" |
| 打包 | `.claude-plugin/plugin.json` + `marketplace.json` | 可安装、可分发 |

### 宠物是全局唯一的

一只全局宠物(`pet.json`),从你**所有**项目的编码成果里成长;`status.json` 反映**当前活跃**会话所在项目的状态。多会话并发时 `status.json` 后写覆盖先写(v1 简化)。

## 5. 物种选择(领养)

- 首次运行,宠物处于"蛋(孵化中)"状态、`species = null`。悬浮窗显示**领养界面**,从启动物种里挑一只:🐱 猫 / 🐶 狗 / 🐉 龙 / 🟢 史莱姆 / 🐦 鸟 / 🦊 狐狸(数量可调)。
- 各物种共用同一套**生命阶段**(蛋→幼体→少年→青年→成年→进化形态),但**外观不同**;蛋的外观按所选物种着色。
- 领养前经验照常累积(蛋在"孵化");选定后写入 `species`,到 Lv2 破壳成对应物种。
- 命令行兜底:`/pet adopt dragon`。
- 美术由 GPT Image 2.0 管线预生成(见第 6 节),不依赖人工绘制,**6 个物种都能完整出图**;仍需作者人工筛选满意的生成结果。

## 6. 美术资产管线(开发期,GPT Image 2.0)

- 精灵图不靠人工绘制,而是**开发期**用一个 Node 脚本调用 OpenAI 图像生成(用户指定 **GPT Image 2.0**)批量生成,结果**烘焙进插件**作为静态 PNG。
- **终端用户无需任何 API key、不联网、不付费**;只有插件作者在构建期用自己的 `OPENAI_API_KEY` 跑一次。
- 生成矩阵:每物种 × 每生命阶段(蛋/幼体/少年/青年/成年/进化形态)× 每表情(心流/开心/普通/犯困/无聊/担心打气)。
- **角色一致性**:先为每物种生成一张定妆基准图,再以它作为参考图(图像编辑/参考输入)生成各阶段与表情变体,保证"同一只宠物"在成长与情绪变化中外观连贯。
- **透明背景**:请求透明背景 PNG 输出,适配悬浮窗叠加。
- 输出落到插件内 `assets/<species>/<stage>/<expression>.png`;脚本可重跑、可单独再生某一格。
- 风格统一由共享风格提示词(像素/Q版/扁平等,规划期定一种)保证。

## 7. 数据契约

两段通过这两个文件通信,原子写入(写临时文件再 rename,避免读到半截 JSON)。

### `~/.claude-pet/pet.json`(持久,全局宠物身份与成长)

```json
{
  "schemaVersion": 1,
  "species": "dragon",
  "name": "Cody",
  "birthday": "2026-05-28T10:00:00Z",
  "xp": 1234,
  "level": 3,
  "stage": "child",
  "mood": 72,
  "lastActivityAt": "2026-05-28T14:30:00Z",
  "recentFailureUntil": null,
  "streak": { "days": 3, "lastActiveDate": "2026-05-28" },
  "achievements": [ { "id": "first-feat", "at": "2026-05-20T09:00:00Z" } ],
  "lifetime": { "linesAdded": 5021, "tokens": 8400000, "sessions": 42, "commits": 73, "testsPassed": 120, "features": 14 },
  "repos": { "kuan/foo": { "lastSeenCommit": "abc123", "lastSeenTag": "v0.2.0" } }
}
```

`species: null` 表示尚未领养。`repos` 记每个仓库已结算到的提交/标签,避免重复加经验、也能捕获在 Claude 之外做的提交。

### `~/.claude-pet/status.json`(当前项目状态快照,每次事件更新)

```json
{
  "schemaVersion": 1,
  "cwd": "/Users/kuan/Projects/Foo",
  "repo": "kuan/foo",
  "branch": "main",
  "contextUsedPct": 64,
  "sessionCostUsd": 0.83,
  "sessionTokens": 120000,
  "gitDirtyCount": 7,
  "minsSinceLastCommit": 95,
  "alerts": ["git"],
  "updatedAt": "2026-05-28T14:30:00Z"
}
```

## 8. 成长机制(事件驱动,成长 + 轻养护,永不死)

数值为起始值,均可调。核心思想:**奖励成果 > 奖励产量**。

### 经验事件(全部只读检测)

| 事件 | 检测方式 | XP |
|------|----------|-----|
| 写代码 | PostToolUse Edit/Write 净增行 | +1/行,单次封顶 +30,每会话该来源封顶 +200(防刷) |
| 新建文件 | Write 创建新文件 | +15 |
| 测试通过 | PostToolUse Bash,命令匹配测试器(jest/vitest/pytest/go test/cargo test/npm test…)且成功 | +40(每会话封顶 +160) |
| 修复 | 新提交且消息以 `fix:` 开头 | +60 |
| **实现功能** | 新提交且消息以 `feat:` 开头 | **+120** |
| 重构/性能 | `refactor:` / `perf:` | +50 |
| 测试/文档/杂务 | `test:` / `docs:` / `chore:` | +40 |
| 普通提交 | 无约定前缀 | +40 |
| **发布/里程碑** | 检测到新 `git tag`,或用户 `/pet milestone "..."` | **+300 + 解锁成就** |
| token 消耗 | 解析 transcript | +5 / 10 万 token(次要来源) |

提交通过"上次结算的 commit 到 HEAD"的只读 `git log` 增量发现并按约定式提交前缀分类(`repos.<repo>.lastSeenCommit` 记账)。

### 连续天数加成(streak)

连续活跃天数 d → 当日经验倍率 = `min(1 + 0.05×(d-1), 2.0)`(最高 2 倍)。中断一天则重置为 1。

### 等级 → 生命阶段(外观随等级 + 物种进化)

| 等级 | 累计XP阈值 | 阶段 |
|------|-----------|------|
| Lv1 | 0 | 🥚 蛋(孵化中) |
| Lv2 | 150 | 🐣 幼体(破壳成所选物种) |
| Lv3 | 450 | 🐤 少年 |
| Lv4 | 1000 | 🧒 青年 |
| Lv5 | 2200 | 🦸 成年 |
| Lv6 | 4500 | ✨ 进化形态 I |
| Lv7 | 9000 | 🌟 进化形态 II |
| Lv8+ | ×2 递增 | 更高进化 |

### 心情(0–100,永不致死)

- 孵化时 80。
- 即时事件影响:`feat` 提交 +10、里程碑 +15、测试通过 +6、普通提交/写代码 +2。
- **打气而非生气**:同一会话内测试连续失败 ≥3 次,或 Bash 命令连续非零退出 → 心情 -8,并设 `recentFailureUntil`(如 30 分钟),宠物切到 😟 担心+打气表情,气泡"别灰心,我陪着你"——绝不表现得生气或责怪。
- 闲置衰减:每空闲 1 小时 -5,下限 10(永不归零、不死)。
- 事件发生时引擎重算;事件之间由窗口按 `lastActivityAt` 本地推算闲置衰减,表情平滑变化。

### 成就(achievements)

解锁即 🎉 并记入 `pet.json`,展开面板可查看。示例:破壳而出(首到 Lv2)、第一个功能(首个 `feat`)、绿灯(首次测试通过)、周更(7 天 streak)、发布!(首个 tag/里程碑)、百提交(累计 100 commits)。

## 9. 四项提醒 → 宠物行为

| 触发条件 | 宠物表现 |
|----------|----------|
| `contextUsedPct` > 80 | 🥵 捂肚子气泡:"我撑住了…该 /compact 啦" |
| 花费 & Token | 展开面板显示;消耗 token 时"吃东西"小动画 |
| `gitDirtyCount` > 15 或 `minsSinceLastCommit` > 120 | 💾 气泡:"别忘了提交哦" |
| 连续高强度编码 > 90 分钟 | 🍵 气泡:"歇会儿?" |
| 升级 | 🎉 庆祝动画 |

`alerts` 由引擎算好写进 `status.json`。**表情优先级**:升级动画 > 提醒气泡 > 失败打气(😟)> 心情表情(🤩/😄/🙂/😴/🥱)。

## 10. 技术栈:Electron

透明、无边框、置顶、可拖动的小窗口托管宠物(HTML/CSS/canvas 动画,加载本地 PNG,运行期不调图像 API)。选 Electron:出效果最快、动画最丰富、与 hook 脚本共用 Node 一套工具链。代价:运行时较重(~150MB)、需要 Node。

macOS 窗口行为需实测:`transparent:true` + `frame:false`、`setAlwaysOnTop(true,'screen-saver')`、`setVisibleOnAllWorkspaces(true)`、本体外鼠标穿透。

## 11. 自启动策略

1. 首选:插件 `monitors` 机制 `when:"always"`,Claude Code 运行时自动拉起窗口(**需在规划阶段确认该能力存在且稳定**)。
2. 兜底:SessionStart hook 检查 `~/.claude-pet/widget.pid`,没在跑就 detached 拉起。
3. 手动:`/pet start` / `/pet stop`。

## 12. 明确不做(v1 YAGNI)

- 全球排行榜、多宠物/繁殖、"拦截 Claude 操作"的 hook、宠物死亡/墓地。
- Windows/Linux 打包(代码保持可移植,但只在 macOS 测试与打包)。
- **运行期 / 按用户实时 AI 生成美术**(需终端用户自带 API key):留作可选未来(想要"独一无二的宠物"可后续加),v1 一律用预生成的烘焙素材。

## 13. 里程碑

- **M1 状态引擎(只读)**:hooks 写 `pet.json` + `status.json`;事件驱动经验(提交分类/测试通过检测/里程碑)、等级、心情、streak、成就逻辑;数据模型含 `species`。`/pet`、`/pet milestone` 命令。不依赖 GUI 即可测。**含零副作用不变量的测试**。
- **M2 悬浮窗**:Electron 透明置顶窗口 + **首次领养选物种**界面;监听文件,渲染宠物 + 心情 + 展开面板(占位/临时素材即可)。
- **M3 提醒与表现**:四种气泡、升级动画、失败打气表情、闲置衰减、成就解锁动画。
- **M4 美术与打包**:跑 GPT Image 2.0 资产管线生成并筛选各物种精灵图、烘焙进插件;plugin.json / marketplace.json / 自启动 / 文档。

## 14. 测试策略

- 状态引擎(纯函数 TDD):`xpForEvent`、`classifyCommit(msg)`、`isTestCommand(cmd)` + `isTestSuccess(output)`、`applyStreakMultiplier`、`levelForXp`、`moodAfter(event|decay)`、`unlockAchievements(state)`、`parseTranscriptUsage`、`gitSnapshot`(mock exec)。
- **零副作用测试**:mock 子进程执行,断言引擎从不调用变更类 git 子命令、从不写入 `cwd` 之下任何路径。
- Hook 集成:喂样例 stdin JSON,断言写出的状态文件。
- 美术管线:对 prompt 构造与文件落盘做单测(mock API 调用),不在 CI 真打 API。
- 悬浮窗:手动 + "fixture 模式"读静态 JSON,无需 Claude 即可调渲染与领养流程。

### 验收标准(可验证)

- 首次运行能在悬浮窗里**从多个物种中领养一只**;`/pet adopt` 也可。
- 一个 `feat:` 提交带来的经验显著多于同等行数的零碎编辑;检测到 `git tag` 或 `/pet milestone` 触发里程碑大额经验 + 成就。
- 测试连续失败时宠物表现为**担心打气**而非生气。
- 关掉 Claude 几小时再开 → 宠物变蔫、随后回升;够阈值即升级并播放动画。
- `/pet` 能报告等级、心情、成就与当前项目状态。
- 各物种各阶段表情的 PNG 已由管线生成并随插件分发,**运行期不调用任何外部图像 API**。
- **全程对用户项目零写入**:无文件改动、无变更类 git 命令(自动化测试 + 代码审查共同保证)。

## 15. 待规划阶段确认的风险点

- 插件 `monitors` 自启动能力是否存在且稳定(调研提到,需查官方文档证实)。
- **GPT Image 2.0 的确切模型 id / API 参数、透明背景支持、参考图保持角色一致的能力**;若一致性不达标的退路(锁定风格提示词 / 统一参考图 / 作者人工修图)。生成成本由作者侧承担、一次性。
- Electron 透明 + 鼠标穿透 + 置顶 + 跨 Space 在 macOS 的实际行为。
- transcript JSONL 的 token/上下文字段名;若解析不可靠,退路是提供可选 `statusLine` 集成拿精确值。
- "测试通过"基于命令/输出的启发式判断,需准备各语言测试器的匹配规则与误判处理。
- 系统 Node 版本要求(hook 经 `node` 运行;文档注明 Node ≥ 18)。
