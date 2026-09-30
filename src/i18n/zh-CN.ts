const zhCN = {
  app: {
    title: "桌面桌宠",
  },
  status: {
    companion: "陪伴中",
  },
  accessibility: {
    openSettings: "打开设置",
    interactWithPet: "和桌宠互动",
  },
  actions: {
    drink: "喝水 +250ml",
    feed: "喂食",
    todo: "Todo",
  },
  hydration: {
    title: "今日饮水",
    targetHint: "目标可在设置中调整",
    goalDone: "今日目标完成",
    remaining: "还差 {{amount}} ml",
    dailyTarget: "每日饮水目标（ml）",
  },
  settings: {
    title: "设置",
    petAppearance: "桌宠形象",
    petSize: "桌宠尺寸",
    alwaysOnTop: "始终置顶",
    autostart: "开机自启",
    autostartHint: "默认关闭",
    reduceMotion: "减少动画",
    language: "界面语言",
    reminderTip: "提醒会在桌宠隐藏时继续运行；退出应用后停止。",
  },
  reminders: {
    mode: "提醒方式",
    intervalOption: "按间隔提醒",
    fixedOption: "固定时间提醒",
    intervalLabel: "间隔分钟",
    fixedLabel: "固定时间（HH:MM）",
  },
  todo: {
    title: "今日待办",
    placeholder: "写下一件小事",
    add: "添加待办",
    empty: "今天还没有 Todo",
  },
  locale: {
    zhCN: "简体中文",
    enUS: "English",
  },
  pets: {
    alaskan: { name: "阿拉斯加", note: "蓬松、可靠、喜欢陪你工作" },
    shepherd: { name: "德国牧羊犬", note: "警觉、聪明、负责提醒你休息" },
    siamese: { name: "暹罗猫", note: "优雅、黏人、偶尔傲娇" },
    maineCoon: { name: "缅因猫", note: "温柔、安静、体型大但桌宠很轻" },
  },
  messages: {
    defaultBubble: "今天也要记得喝水呀。",
    hydrationGoalDone: "今天的饮水目标完成啦！",
    hydrationRecorded: "很好，喝水完成，继续保持。",
    notificationUnavailable: "系统通知暂不可用，我会继续在桌宠里提醒你。",
    reminder: "该喝水啦，完成后点一下喝水按钮。",
    notificationBody: "今天已完成 {{done}} / {{target}} ml",
    autostartUnavailable: "开机自启需要安装后的应用环境，当前先保留设置。",
    todoAdded: "已记下这件小事。",
    petInteraction: "摸摸我！今天也一起专注一下。",
    feed: "谢谢投喂！我会乖乖陪着你。",
    petChanged: "换成{{pet}}啦。",
  },
} as const;

export default zhCN;

