# 桌面桌宠

一个面向 Windows 10/11 的轻量桌面桌宠 MVP，采用 Tauri 2 + Rust + TypeScript/CSS。

## 当前骨架

- 阿拉斯加、德国牧羊犬、暹罗猫、缅因猫四种形象切换（当前使用占位 Emoji）
- 拖动、记住位置、尺寸调节、始终置顶
- 系统托盘：显示、隐藏、退出
- 开机自启开关（默认关闭）
- 按间隔或固定时间提醒喝水，记录每日饮水目标与进度
- 喝水、喂食动画反馈
- Todo 创建与完成状态
- Windows 深浅色跟随、减少动画开关
- 预留 `.pet-skin` 外部皮肤协议，MVP 暂不实现导入 UI
- 界面文案通过 `src/i18n` 管理，当前支持简体中文和 English
- Rust 托盘文案通过 `src-tauri/locales` 管理，新增语言时无需修改托盘逻辑
- 最新角色概念稿位于 `assets/concepts/pet-character-concept-v1.png`
- 动画资源生产规范位于 `docs/animation-asset-pipeline.md`

## 多语言入口

Web UI 的语言字典位于 `src/i18n/zh-CN.ts` 与 `src/i18n/en-US.ts`，语言选择入口位于设置面板；新增语言时增加字典并在 `src/i18n/index.ts` 注册。

Rust 托盘使用 `src-tauri/locales/zh-CN.json` 与 `src-tauri/locales/en-US.json`。当前可通过 `DESKTOP_PET_LOCALE=en-US` 选择原生托盘语言，后续可以把它与 Web UI 的设置持久化统一起来。

## 本地开发

需要 Node.js、Rust/Cargo、WebView2，以及 Tauri 2 的 Windows 构建环境。

```powershell
npm install
npm run tauri:dev
```

当前仓库只提交源代码骨架；真实构建与桌面运行需要在 Rust 工具链可用后验证。
