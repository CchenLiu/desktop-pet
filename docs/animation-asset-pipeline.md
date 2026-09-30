# 桌宠角色与动画资源方案

## 当前结论

概念图可以作为视觉标准，但不能仅凭一张合成图直接得到稳定、连续且品种一致的动画。静态显示可以完整使用最终 PNG/WebP；动作需要单独生产角色母版和动作帧。

MVP 采用透明 WebP/PNG 序列帧图集。它比实时 3D、Live2D 或 Spine 更轻，能最大程度保留毛发细节，也适合 Tauri WebView 渲染。

## 制作流程

1. 每个品种先制作一张独立的透明背景正面母版，建议画布 `512 × 512`。
2. 固定头身比例、眼睛位置、脚底线、阴影范围和角色中心锚点。
3. 基于母版逐动作绘制或生成关键帧，保持毛色、五官和轮廓一致。
4. 将每个动作导出为透明 WebP 图集，并生成对应 manifest。
5. 在应用中预加载当前角色的待机资源，其他动作按需加载。
6. 使用状态机控制动作优先级、播放次数、打断规则和结束后的回退状态。

## MVP 动作集合

| 状态 | 建议帧数 | 循环 | 触发方式 |
|---|---:|---|---|
| `idle` | 8–12 | 是 | 默认状态，轻微呼吸和毛发起伏 |
| `blink` | 4–6 | 否 | 待机期间随机触发 |
| `touch` | 6–8 | 否 | 单击或抚摸桌宠 |
| `drink` | 10–14 | 否 | 完成喝水记录 |
| `feed` | 10–14 | 否 | 点击喂食 |
| `remind` | 8–12 | 是 | 喝水或 Todo 到期提醒 |
| `drag` | 4–6 | 是 | 拖动窗口期间 |
| `happy` | 8–12 | 否 | 完成目标或 Todo |
| `sleep` | 8–12 | 是 | 长时间无交互时可选 |

## 资源目录建议

```text
assets/pets/<pet-id>/
  manifest.json
  preview.webp
  idle.webp
  blink.webp
  touch.webp
  drink.webp
  feed.webp
  remind.webp
  drag.webp
  happy.webp
  sleep.webp
```

## manifest 示例

```json
{
  "schemaVersion": 1,
  "id": "alaskan-default",
  "canvas": { "width": 512, "height": 512 },
  "anchor": { "x": 0.5, "y": 0.94 },
  "animations": {
    "idle": { "src": "idle.webp", "frames": 10, "fps": 8, "loop": true },
    "drink": { "src": "drink.webp", "frames": 12, "fps": 12, "loop": false }
  }
}
```

## 还原度边界

- 静态形象：使用最终透明母版时，可以做到与最终资源像素级一致。
- 桌面显示：默认约 72 逻辑像素，细毛会被缩小；需专门检查小尺寸轮廓和眼睛可读性。
- 动画形象：必须保证每帧基于同一母版，单独生成的无约束图片会出现脸型、毛色和体型漂移。
- 当前概念图：四个角色处于同一背景中，只适合设计确认，不能直接切割为正式动画资产。

