# 技术设计

## 窗口与交互

- 主窗口保持透明、无边框、置顶和跳过任务栏。
- 常态只显示小尺寸宠物与悬浮快捷按钮；设置/Todo 以固定可读尺寸浮层打开，避免随宠物缩放。
- 拖动由 Tauri `startDragging` 发起，拖动结束保存物理坐标；恢复时由 Rust 侧或可用屏幕信息校正到最近显示器工作区。
- 关闭事件改为隐藏，退出只由托盘菜单触发。

## 状态模型

- `PetState`：当前宠物、视觉尺寸、动作状态、减少动画。
- `HydrationState`：目标模式、成人基线档位、自定义目标、当日完成量、日期、提醒模式和值。
- `TodoItem`：`id/title/remindAt/done/notified`，不增加扩展字段。
- `WindowState`：位置、始终置顶、自启。
- 继续使用版本化 localStorage；读取时迁移旧 `desktop-pet-state-v1` 数据。

## 角色与动画

- 资源目录为 `src/assets/pets/<pet-id>/portrait.png`，数据表只存资源 URL 和多语言键。
- 动作状态：`idle | touch | drag | drink | feed | remind | happy`。
- MVP 用同一透明母版配合 transform/filter/伪元素动画；动作定时结束后回到 `idle`。
- 保留 `PetAnimationManifest` 类型与加载入口，后续可把单图替换成 WebP sprite sheet，无需改业务事件。

## 提醒

- 页面每 15 秒检查一次提醒。
- 间隔提醒按“距上次提醒的真实时间”计算，不使用分钟取模，避免 90 分钟等间隔失效。
- 固定时间使用 `HH:MM`；同一分钟只触发一次。
- Todo 使用本地 ISO 时间，到期且未完成/未通知时触发一次通知并标记。

## 饮水目标

- 指南模式提供成年女性 1500ml、成年男性 1700ml 两档，默认采用 1600ml 通用值仅用于旧数据迁移展示。
- 自定义模式限制 200–5000ml。
- 明示这是日常参考而非医疗建议。

## 皮肤扩展

- 定义 schema v1：身份、画布、锚点、预览和动作资源映射。
- MVP 仅保留类型、校验边界和文档，不开放文件选择与安装。

## 验证策略

- 本机仅运行 TypeScript/Vite 构建与静态检查。
- Rust/Tauri 完整编译、打包和产物上传由 GitHub Actions Windows runner 完成。
