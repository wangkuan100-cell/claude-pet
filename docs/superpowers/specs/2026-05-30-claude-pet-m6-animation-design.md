# claude-pet M6: Living Pet — CSS Pseudo-3D Animation — Design

- 日期: 2026-05-30
- 状态: 设计已通过("可以 继续"),待写计划执行
- 依赖: M5(卡通 3D 贴图 + 进化链 + 渲染层)。纯渲染层改动。

## 目标

让宠物"活起来 + 有立体感",不上 three.js、不加素材、不加花费。纯 CSS/DOM 动画作用在现有透明贴图(真 PNG 与 emoji 兜底都适用)。

## 改动(只在 `widget/renderer/`)

1. **持续待机动画(伪 3D)**:在精灵外包一层 `#sprite-stage`,父级 `#pet` 加 `perspective`。`#sprite-stage` 持续做:上下浮动(`translateY` 呼吸感)+ 轻微 3D 倾斜摇摆(`rotateY` ±7°、`rotateX` ±2°),像 3D 模型缓慢转身。内层图片/emoji 的尺寸缩放不变(动画在外层容器,和内层缩放叠加,互不冲突)。心情角标 `#sprite-expr` 留在 `#sprite` 上、不跟着转(保持固定徽标)。

2. **随心情变化**:`pet.js` 按 `data.expression` 给 `#sprite-stage` 加 class(`mood-flow/happy/normal/sleepy/bored/worried`),CSS 调整动画:心流更快更弹、犯困更慢更下垂、无聊几乎静止、担心用轻摇(沿用 M3 的 sway,迁移到 stage)。

3. **环境粒子**:`#particles` 层里 `pet.js` 每隔约 0.8s 生成一颗小星火 div,向上飘并淡出后自动移除,同时最多几颗。轻、淡,营造氛围。仅在 pet 模式开启,领养/无宠物时关闭。

4. **互动反馈**:点击精灵时一次快速挤压回弹(小 `pop`)。

## 不变量

- 不碰引擎/数据/hooks;不加素材、不加运行时依赖、不联网。
- M5 的真 PNG `<img>` 分支与 emoji 兜底都照常显示,只是外层多了动画。
- 现有触发式动画(升级弹跳、进化白光、提醒气泡、成就 toast)保留并与待机动画共存。

## 验收标准

- pet 模式下精灵持续轻微浮动 + 3D 倾斜摇摆(肉眼可见"活的、立体")。
- 切换心情 → `#sprite-stage` 带对应 `mood-*` class,动画手感随之变化(担心=轻摇)。
- 宠物周围有少量上浮淡出的星火粒子;领养界面无粒子。
- `node --test` 仍全绿(动画为 CSS/DOM,不影响纯函数测试)。
- 通过浏览器预览:断言 `#sprite-stage` 存在且带 `mood-*` class、有 idle 动画、粒子元素 > 0;截图抓到倾斜/浮动的一帧。最终顺滑度由用户在 `npm run widget` 肉眼确认。

## 交付

简短 spec → 写计划 → 执行 + 截图验证 → 叠加 PR #6(base m5)。
