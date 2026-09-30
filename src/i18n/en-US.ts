const enUS = {
  app: {
    title: "Desktop Pet",
  },
  status: {
    companion: "Companion mode",
  },
  accessibility: {
    openSettings: "Open settings",
    interactWithPet: "Interact with desktop pet",
  },
  actions: {
    drink: "Drink +250ml",
    feed: "Feed",
    todo: "Todo",
  },
  hydration: {
    title: "Today's hydration",
    targetHint: "Change the target in settings",
    goalDone: "Today's target complete",
    remaining: "{{amount}} ml left",
    dailyTarget: "Daily hydration target (ml)",
  },
  settings: {
    title: "Settings",
    petAppearance: "Pet appearance",
    petSize: "Pet size",
    alwaysOnTop: "Always on top",
    autostart: "Start with Windows",
    autostartHint: "Off by default",
    reduceMotion: "Reduce motion",
    language: "Interface language",
    reminderTip: "Reminders continue while the pet is hidden and stop when the app exits.",
  },
  reminders: {
    mode: "Reminder mode",
    intervalOption: "At an interval",
    fixedOption: "At a fixed time",
    intervalLabel: "Interval in minutes",
    fixedLabel: "Fixed time (HH:MM)",
  },
  todo: {
    title: "Today's Todo",
    placeholder: "Write a small task",
    add: "Add Todo",
    empty: "No Todo for today",
  },
  locale: {
    zhCN: "Chinese (Simplified)",
    enUS: "English",
  },
  pets: {
    alaskan: { name: "Alaskan malamute", note: "Fluffy, reliable, and ready to work with you" },
    shepherd: { name: "German shepherd", note: "Alert, clever, and ready to remind you to rest" },
    siamese: { name: "Siamese cat", note: "Elegant, affectionate, and occasionally proud" },
    maineCoon: { name: "Maine Coon", note: "Gentle, quiet, and big but lightweight on your desktop" },
  },
  messages: {
    defaultBubble: "Remember to drink some water today.",
    hydrationGoalDone: "Today's hydration target is complete!",
    hydrationRecorded: "Nice, hydration recorded. Keep going.",
    notificationUnavailable: "System notifications are unavailable; I will keep reminding you here.",
    reminder: "Time for some water. Tap the drink button when done.",
    notificationBody: "Completed {{done}} / {{target}} ml today",
    autostartUnavailable: "Start with Windows is available after installation; the setting is kept for now.",
    todoAdded: "Small task saved.",
    petInteraction: "Give me a pat! Let's focus together.",
    feed: "Thanks for the snack! I will keep you company.",
    petChanged: "Switched to {{pet}}.",
  },
} as const;

export default enUS;
