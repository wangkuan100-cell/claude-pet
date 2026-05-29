# claude-pet M7: Movable / Draggable Pet — Design

- 日期: 2026-05-30
- 状态: 设计已通过("ok"),待实现
- 依赖: M2 悬浮窗 + M3 鼠标穿透 + M6 动画。纯渲染层 + 主进程改动,不碰引擎/数据/hooks。

## 目标

用户可以把宠物拖到屏幕任意位置,松手后停在那里,**下次启动恢复到该位置**。拖动与"点击开状态面板"在同一只宠物上共存。

## 做法(手动 JS 拖动,Approach A)

1. **拖/点区分(`pet.js`)**:在 `#sprite` 上 `mousedown` 记录鼠标屏幕坐标、开始拖动态;`document` 的 `mousemove` 累计位移,超过阈值(~4px)判定为拖动并实时 `dragMove`;`mouseup` 结束:若**移动过**=拖动(不开面板),若**没移动**=纯点击(开/关面板 + M6 挤压回弹)。移除旧的 `click` 处理,避免与 mouseup 重复。

2. **移窗(`main.cjs` + `preload.cjs`)**:IPC `drag-start {sx,sy}`(记录鼠标屏幕坐标 + `win.getPosition()`)、`drag-move {sx,sy}`(按位移 `win.setPosition`)、`drag-end`(存盘当前位置)。

3. **记住位置(`widget/window-pos.js`,新)**:`loadPos()/savePos([x,y]|{x,y})` 读写 `~/.claude-pet/widget.json`(复用 `state.js` 的 `baseDir`,原子写)。`main` 在 `drag-end` 存,在 `createWindow` 用 `loadPos()` 决定初始位置(没存过→默认右上角)。

4. **与鼠标穿透协调(`pet.js`)**:拖动进行中设 `dragging` 标记;`mouseleave` 在拖动中不关闭交互(`setInteractive(false)`),避免窗口移到鼠标下导致穿透中断拖动;拖动结束恢复正常(光标随窗一起移动,结束时仍在宠物上,移开时再自然关闭交互)。

5. **去掉系统拖动区(`index.html`)**:移除 `#sprite` 的 `class="drag"`(`-webkit-app-region: drag`),改用手动拖动,避免与系统级拖动冲突。

## 不变量

- 不碰引擎/数据/hooks;仍对项目零副作用(只多写 `~/.claude-pet/widget.json`)。
- 现有动画(待机、升级、进化、提醒、成就、粒子)与真图/emoji 渲染照常。

## 验收标准

- 在宠物上按住拖动 → 窗口跟随鼠标移动;松手 → 位置写入 `~/.claude-pet/widget.json`;重启后宠物出现在该位置。
- 在宠物上"纯点击"(不拖) → 仍然开/关状态面板。
- 拖动过程中不会因鼠标穿透中断。
- `widget/window-pos.js` 的 `savePos`→`loadPos` round-trip 有单测;无文件时 `loadPos()` 返回 null。
- `node --test` 全绿。
- 真实拖动/记忆位置在 `npm run widget` 肉眼确认(渲染层逻辑用浏览器预览验证:纯点击开面板、拖动触发移窗调用)。

## 交付

简短 spec → 实现 + 单测 + 预览验证 → 叠加 PR #7(base m6)。
