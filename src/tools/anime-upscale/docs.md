# Anime Upscale

使用 Hugging Face Xenova 模型在浏览器中放大二次元图像。

## 功能
- 2x / 4x 两种模型
- WebGPU / WASM 运行时选择
- 精度模式（FP32 / Q4 / UINT8 / Q4F16）
- Tiled 分块放大与内存控制
- 前后对比预览与下载 PNG

## 使用步骤
1. 上传或拖拽图片。
2. 选择模型、运行时与精度（必要时启用 Tiled）。
3. 点击 Upscale 生成输出。
4. 在预览中查看并点击 Download 保存。

## 注意
- 首次运行会下载模型文件，时间取决于网络。
- WebGPU 更快，WASM 兼容性更好。
- 大图建议使用 Tiled 模式以降低显存/内存占用。
