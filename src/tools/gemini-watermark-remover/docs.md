# Gemini Watermark Remover

在浏览器中移除 Gemini 的可见右下角水印，不做 AI 补画。

## 功能
- 本地执行 reverse alpha blending
- 支持自动选择 48×48 / 96×96 水印规格
- 可手动强制 48×48 或 96×96 模式
- 原图 / 去水印结果并排预览
- 默认导出 PNG，避免再次有损压缩

## 使用步骤
1. 上传或拖拽图片。
2. 保持 Auto，或按需切换 48×48 / 96×96。
3. 点击 Remove watermark 生成结果。
4. 点击 Download PNG 保存。

## 注意
- 仅适用于 Gemini 的可见水印，不处理 SynthID 等不可见水印。
- 该工具不会启用 AI inpaint 或 denoise，只做数学反混合。
- 如果图片已被二次压缩、缩放或截图，边缘可能仍有轻微残影。

## Attribution
- Based on the reverse alpha blending approach from `allenk/GeminiWatermarkTool` (MIT).
