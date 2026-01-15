# AIGC Detector

Detect the AI-generated probability of Chinese text with on-device inference.

## Features
- On-device ONNX inference (no text upload)
- Chunked analysis for long text (adjustable chunk size)
- Label ranking with confidence scores
- Model load/unload with progress

## Steps
1. Paste Chinese text or click Sample.
2. Adjust the chunk size if needed.
3. Click Analyze to view results.
4. Click Unload to free memory.

## Notes
- First run downloads and caches the model from Hugging Face.
- Whitespace is removed before inference.
- Results are probabilistic; short or mixed-language text may be unstable.
