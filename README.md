# 桌面桌宠

一个面向 Windows 10/11 的轻量桌面桌宠 MVP，采用 Tauri 2 + Rust + TypeScript/CSS。

## 当前功能

- 阿拉斯加、德国牧羊犬、暹罗猫、缅因猫四种独立透明角色母版
- 待机、触摸、拖动、喝水、喂食、提醒和完成动作反馈
- 拖动、记住位置、多屏坐标校正、48–144px 尺寸调节、始终置顶
- 系统托盘：显示、隐藏、退出
- 开机自启开关（默认关闭）
- 按间隔或固定时间提醒喝水，支持健康指南估算和自定义每日目标
- Todo 创建、到期提醒、完成与删除，不包含重复、优先级、分类和备注
- Windows 深浅色跟随、减少动画开关
- 预留 `.pet-skin` 外部皮肤协议和校验类型，MVP 暂不实现导入 UI
- 界面文案通过 `src/i18n` 管理，当前支持简体中文和 English
- Rust 托盘文案通过 `src-tauri/locales` 管理，新增语言时无需修改托盘逻辑
- 最新角色概念稿位于 `assets/concepts/pet-character-concept-v1.png`
- 动画资源生产规范位于 `docs/animation-asset-pipeline.md`
- 皮肤协议草案位于 `docs/pet-skin-format.md`

## 多语言入口

Web UI 的语言字典位于 `src/i18n/zh-CN.ts` 与 `src/i18n/en-US.ts`，语言选择入口位于设置面板；新增语言时增加字典并在 `src/i18n/index.ts` 注册。

Rust 托盘使用 `src-tauri/locales/zh-CN.json` 与 `src-tauri/locales/en-US.json`。当前可通过 `DESKTOP_PET_LOCALE=en-US` 选择原生托盘语言，后续可以把它与 Web UI 的设置持久化统一起来。

## 本地开发

需要 Node.js、Rust/Cargo、WebView2，以及 Tauri 2 的 Windows 构建环境。

```powershell
npm install
npm run tauri:dev
```

本机可运行前端构建；Windows 安装包由 `.github/workflows/windows-build.yml` 在 GitHub Actions 中编译并上传为 `desktop-pet-windows` artifact。
