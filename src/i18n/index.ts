import enUS from "./en-US";
import zhCN from "./zh-CN";

export type Locale = "zh-CN" | "en-US";
type MessageValue = string | { readonly [key: string]: MessageValue };

const localeStorageKey = "desktop-pet-locale-v1";
const dictionaries: Record<Locale, MessageValue> = { "zh-CN": zhCN, "en-US": enUS };
const localeByLanguage: Record<string, Locale> = { zh: "zh-CN", "zh-CN": "zh-CN", en: "en-US", "en-US": "en-US" };

const readLocale = (): Locale => {
  const stored = localStorage.getItem(localeStorageKey);
  if (stored === "zh-CN" || stored === "en-US") return stored;
  return localeByLanguage[navigator.language] ?? "zh-CN";
};

let activeLocale: Locale = readLocale();

const resolve = (source: MessageValue, key: string): MessageValue | undefined => {
  const value = key.split(".").reduce<MessageValue | undefined>((current, segment) => {
    if (!current || typeof current === "string") return undefined;
    return current[segment];
  }, source);
  return value;
};

export const getLocale = () => activeLocale;

export const setLocale = (locale: Locale) => {
  activeLocale = locale;
  localStorage.setItem(localeStorageKey, locale);
  document.documentElement.lang = locale;
};

export const localeOptions: ReadonlyArray<{ value: Locale; labelKey: string }> = [
  { value: "zh-CN", labelKey: "locale.zhCN" },
  { value: "en-US", labelKey: "locale.enUS" },
];

export const t = (key: string, variables: Record<string, string | number> = {}) => {
  const value = resolve(dictionaries[activeLocale], key) ?? resolve(dictionaries["en-US"], key);
  if (typeof value !== "string") return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, variable: string) => String(variables[variable] ?? `{{${variable}}}`));
};

document.documentElement.lang = activeLocale;

