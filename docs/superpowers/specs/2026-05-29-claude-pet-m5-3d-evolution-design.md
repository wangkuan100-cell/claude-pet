# claude-pet M5: 3D-Cartoon Art + Evolution Chains — Design

- 日期: 2026-05-29
- 状态: 设计已口头通过("可以开干、好看卡通一点"),待写计划执行
- 依赖: M4(art pipeline + widget)。本设计是对 M1 阶段模型 + M4 美术管线的演进。

## 1. 目标

把宠物从"6 物种 × 5 通用阶段、emoji/平面贴图"改成:

- **6 条主题进化链**,每条 **6 个形态、5 次进化**:蛋 → 雏 → 幼 → 少年 → 成年 → **终极传说体**。
- 美术换成 **可爱卡通 3D 渲染风**(皮克斯风、大眼睛、圆润光泽),由 GPT Image 2.0 出透明 PNG。
- 复用现有 Electron 悬浮窗(不上 three.js):每个形态出 **1 张中性 3D 底图**,心情靠现有"表情 emoji 角标"体现。

## 2. 进化链(6 条线 × 6 形态)

形态层级键(所有线共用):`egg → hatchling → juvenile → adolescent → adult → legendary`,映射等级 Lv1→Lv6+(终极体 Lv6 起,沿用现有 XP/等级阈值不变)。

| 线 | egg | hatchling | juvenile | adolescent | adult | legendary(终极) |
|----|-----|-----------|----------|------------|-------|------------------|
| phoenix | 蛋 | 雏鸟 | 小鸡 | 幼鸟 | 火羽鹰 | 🔥 凤凰 |
| dragon | 蛋 | 龙崽 | 小龙 | 少年龙 | 成年龙 | 🐉 龙王 |
| kitsune | 蛋 | 狐崽 | 小狐 | 少年狐 | 成年狐 | ✨ 九尾狐 |
| cerberus | 蛋 | 幼犬 | 小狗 | 少年犬 | 成年犬 | 🐺 三头地狱犬 |
| sphinx | 蛋 | 猫崽 | 小猫 | 少年猫 | 成年猫 | 🦁 带翼狮身兽 |
| golem | 蛋 | 小史莱姆 | 史莱姆 | 结晶史莱姆 | 巨型史莱姆 | 💎 水晶魔像王 |

每条线、每个形态在 `src/lines.js` 里定义:显示名、emoji 兜底、出图用的英文描述。各线的 `egg` 可共用一个"该线主题色的蛋"描述。

## 3. 等级 → 形态映射

`stageForLevel(level)`(改 `src/levels.js`):
- Lv1 → `egg`,Lv2 → `hatchling`,Lv3 → `juvenile`,Lv4 → `adolescent`,Lv5 → `adult`,Lv≥6 → `legendary`。
- 阈值不变(Lv2=150…Lv6=4500 XP)。到 Lv6 = 终极进化时刻。
- 未领养(`species===null`)时形态仍是 `egg`(通用蛋)。

## 4. 美术(可爱卡通 3D)

- 共享风格提示词(`art/prompts.js` 的 `STYLE`):`cute cartoon 3D render, Pixar-style, big expressive eyes, soft rounded shapes, glossy smooth shading, soft studio lighting, subtle ambient occlusion, vibrant saturated colors, adorable mascot, centered single character, plain transparent background, no text, no drop shadow`。
- 每形态出 **1 张中性表情底图**;矩阵 = `线 × 形态`(不再 ×表情)。共 **6 × 6 = 36 张**。
- 资源路径:`assets/<line>/<form>.png`(M4 的 `<species>/<stage>/<expression>.png` 简化为此)。
- 心情:沿用现有 `sprite-expr` 角标 emoji(😄😴😟…),贴在 3D 底图右上角。
- 出图流程:先出 **phoenix 一条线(6 张)做样片**验证卡通 3D 质感 + 进化连贯,确认后批量出全部 36 张。账单已充值。

## 5. 代码改动(M5 分支,叠加 M4)

- 新增 `src/lines.js`:6 条线 × 6 形态的 {显示名, emoji, artPrompt 描述};导出 `LINES`、`FORMS`、`lineFor(id)`。
- `src/levels.js`:`stageForLevel` 改成上面的 6 形态映射;更新 `test/levels.test.js`。
- `art/prompts.js`:`STYLE` 换卡通 3D;矩阵改 `线 × 形态`;`promptFor(line, form)`;`outputPath` 改 `<line>/<form>.png`。更新 `test/art.test.js`。
- `widget/placeholders.js`:emoji 兜底改成按 `line/form` 取(用 `lines.js`);更新测试。
- `widget/sprite-source.js`:`assetUrlFor(assetsDir, spriteKey)` 适配 `line/form`(两段 key);更新测试。
- `widget/render-logic.js`:`spriteKey = \`${species}/${form}\``(去掉表情);`buildPaintData` 仍带 expression 角标;`paintEvents` 增加 **`evolved` 检测**(形态层级跨越,如 adult→legendary 或任意 form 变化)→ paint-data 带 `events.evolved`。更新测试。
- `widget/main.cjs`:`imageSrc` 路径用 `${line}/${form}`;`repaint` 算 events 时带 form 变化。
- `widget/renderer/*`:领养界面 6 个选项改成"进化线"(显示终极形态主题 emoji + 名);`pet.js` 收到 `events.evolved` 放**进化动画**(比普通升级更隆重,如白光 + "进化!"横幅)。
- `package.json`:`gen-art` 不变(脚本读新矩阵)。

## 6. 不变量与回退

- 仍**对项目零副作用**(只读 hook、只写 `~/.claude-pet`)。
- **无图自动回退 emoji**:没生成的形态用 `lines.js` 的 emoji 兜底,所以代码先行、出图后自动接管。

## 7. 验收标准

- 领养可从 6 条进化线里选一条;宠物随等级 egg→…→legendary 共 6 形态。
- 跨越形态(尤其 Lv6 终极体)触发"进化"动画(比普通升级隆重)。
- 生成的卡通 3D PNG 出现在悬浮窗(`assets/<line>/<form>.png`),无图回退 emoji。
- `node --test` 全绿(含改后的 levels/art/placeholders/sprite-source/render-logic 测试)。
- phoenix 样片经肉眼确认为"好看的卡通 3D + 进化连贯"后再批量出全部 36 张。

## 8. 交付

M5 spec → 写计划(writing-plans)→ 子代理执行 + 控制端出图/肉眼验证 → 叠加 PR #5(base m4)。
