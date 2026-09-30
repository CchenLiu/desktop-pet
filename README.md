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

## 本地开发

需要 Node.js、Rust/Cargo、WebView2，以及 Tauri 2 的 Windows 构建环境。

```powershell
npm install
npm run tauri:dev
```

当前仓库只提交源代码骨架；真实构建与桌面运行需要在 Rust 工具链可用后验证。

