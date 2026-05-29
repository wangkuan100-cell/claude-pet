# claude-pet M8: Desktop Wandering + Double-Click Feeding — Design

- 日期: 2026-05-30
- 状态: 设计已通过(溜达默认关),待实现
- 依赖: M2–M7。渲染层 + 主进程 + 引擎(feed 事件)改动,不碰只读 hooks/项目。

## 目标

两个新交互:(A) 宠物可沿桌面底边自主溜达(**默认关**,opt-in);(B) 双击宠物喂食(心情提升 + 吃东西动画),单击仍开面板。

## A. 桌面边缘溜达(opt-in)

- **开关**:仅当 `CLAUDE_PET_WANDER=1` 时启用(默认关 → 沿用 M7,宠物停在你放的位置)。
- **行为**(主进程):启用时每隔 ~40s,若当前没在拖动,沿主显示器**底边**随机挑一个 x,窗口分步 `setPosition` 滑过去(~1.5s,缓动),期间通知渲染层放"走路"动画(左右摆 + 按移动方向水平翻转)。到位后存盘位置(重启恢复)。拖动时跳过该周期;手动拖动后从新位置继续溜达。
- **纯函数**(`widget/wander.js`,可单测):`pickWanderTarget(workArea, winSize, rng)` → 底边的 `{x,y}`;`glidePath(from, to, steps)` → 逐帧位置数组(缓动)。主进程只负责定时 + 调 `setPosition` + 发 walk IPC。

## B. 双击喂食

- **单击 vs 双击**(渲染层,280ms 消歧):非拖动的点击先挂起 280ms;若 280ms 内来第二次点击 → 判为双击 → **喂食**(不开面板);否则 → 单击 → 开/关面板。避免双击误触面板、也不闪。
- **喂食效果**:渲染层放"吃东西"动画(`#sprite-stage` 咀嚼挤压 + 几颗 ❤️/😋 上飘);并发 `feed` IPC。
- **引擎 feed 事件**(`src/engine.js` + `constants.js`):新增 `MOOD_DELTA.feed = 8` 和 `MOOD_EVENT.feed`,`applyEvent({type:'feed'})` → 心情 +8(封顶 100)、刷新活跃度(perk up)、不给经验、不改 lifetime。纳入纯函数测试。
- **主进程**:`feed` IPC → `engine.applyEvent(pet, {linesXp:0,testXp:0}, {type:'feed'})` → 存盘 → 重绘;带 ~3s 轻冷却防刷(内存计时)。

## 改动文件

`src/constants.js`、`src/engine.js`、`widget/wander.js`(新)、`widget/main.cjs`(import engine + feed IPC + wander 定时/滑动)、`widget/preload.cjs`(feed、onWalk)、`widget/renderer/pet.js`(单/双击消歧 + 吃东西/走路动画)、`widget/renderer/styles.css`(chomp/hearts/walk 关键帧)、测试(engine feed、wander 纯函数)。

## 不变量

- 不碰只读 hooks/项目;仍只写 `~/.claude-pet/`。
- 溜达默认关;现有拖动/动画/真图/emoji 照常。

## 验收标准

- `CLAUDE_PET_WANDER=1` 时宠物会沿底边溜达并播走路动画;默认(不设)时不动,停在放置处。
- 双击宠物 → 心情 +8(封顶 100)+ 吃东西动画;单击仍开/关面板(双击不误触)。
- `pickWanderTarget`/`glidePath` 与 engine `feed` 事件有单测;`node --test` 全绿。
- 渲染层动画(吃东西/走路)与单双击消歧在浏览器预览验证;溜达的真实自主移动在 `npm run widget`(设 `CLAUDE_PET_WANDER=1`)肉眼确认。

## 交付

简短 spec → 实现 + 单测 + 预览验证 → 分支 m8 → PR 或直接合 main。
