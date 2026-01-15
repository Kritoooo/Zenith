# Anime Upscale

Upscale anime-style images in the browser using Hugging Face Xenova models.

## Features
- 2x / 4x models
- WebGPU / WASM runtime selection
- Precision modes (FP32 / Q4 / UINT8 / Q4F16)
- Tiled upscale and memory control
- Side-by-side preview and PNG download

## Steps
1. Upload or drag an image.
2. Choose model, runtime, and precision (enable Tiled if needed).
3. Click Upscale to generate output.
4. Preview and click Download to save.

## Notes
- First run downloads model files; time depends on your network.
- WebGPU is faster, WASM is more compatible.
- For large images, use Tiled mode to reduce memory usage.
