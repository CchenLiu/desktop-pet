# `.pet-skin` 皮肤协议预留

MVP 暂不开放导入界面，但运行时资源层按 schema v1 设计，后续可以把内置单图替换为第三方 WebP 序列帧。

## 包结构

```text
skin.pet-skin/
  manifest.json
  preview.png
  idle.webp
  touch.webp
  drag.webp
  drink.webp
  feed.webp
  remind.webp
  happy.webp
```

## manifest

```json
{
  "schemaVersion": 1,
  "id": "example-pet",
  "name": "Example Pet",
  "canvas": { "width": 512, "height": 512 },
  "anchor": { "x": 0.5, "y": 0.96 },
  "preview": "preview.png",
  "animations": {
    "idle": { "src": "idle.webp", "frames": 10, "fps": 8, "loop": true },
    "drink": { "src": "drink.webp", "frames": 12, "fps": 12, "loop": false }
  }
}
```

## MVP 校验边界

- `schemaVersion` 必须为 `1`。
- `id`、`name`、`preview` 必须为非空字符串。
- 画布建议为 `512 × 512`，角色脚底锚点保持在接近 `y = 0.96`。
- 动作名仅允许 `idle`、`touch`、`drag`、`drink`、`feed`、`remind`、`happy`。
- 正式导入功能实现时还需增加路径穿越、压缩包大小、图片像素、帧数和总解压大小校验。
