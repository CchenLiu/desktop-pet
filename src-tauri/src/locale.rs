use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TrayLocale {
    pub tooltip: String,
    pub show: String,
    pub hide: String,
    pub settings: String,
    pub quit: String,
}

pub fn load() -> TrayLocale {
    let locale = std::env::var("DESKTOP_PET_LOCALE").unwrap_or_else(|_| "zh-CN".to_owned());
    let source = if locale.eq_ignore_ascii_case("en-US") {
        include_str!("../locales/en-US.json")
    } else {
        include_str!("../locales/zh-CN.json")
    };

    serde_json::from_str(source).expect("invalid tray locale file")
}

