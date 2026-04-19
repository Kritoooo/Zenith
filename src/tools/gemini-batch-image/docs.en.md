# Gemini Batch Image

Pick a folder of images and have the Gemini image model (Nano Banana) apply the same prompt to every one of them, in the browser.

## Features
- Upload an entire folder (drag & drop or the file picker) or add individual images on top.
- Shared prompt is applied to every queued image.
- Adjustable parallelism (1–4) with a real Stop button that cancels in-flight requests via `AbortSignal`.
- Per-image status, per-image Retry for transient failures, and individual Download.
- Batch Download ZIP (built in a Web Worker, no extra dependencies).
- Output filename = original base name + suffix (default `-gemini`) + `.png`. Subfolder collisions are resolved automatically.

## Steps
1. Paste your Gemini API key. Check "Remember on this device" to keep it in `localStorage`; leave it unchecked to keep it only for this session.
2. Drop a folder (or click to pick one). JPEG / PNG / WebP are processed; other types are marked as Skipped.
3. Write the prompt to apply to every image. Optionally tweak the filename suffix and parallelism.
4. Press **Run**. Watch the per-image status tiles. Hit **Stop** any time.
5. Use **Download ZIP** for the whole batch, or Download per image.

## Notes
- Your API key is sent directly from the browser to the configured endpoint — it never goes through Zenith.
- Leave **Custom base URL** empty to use Google's `generativelanguage.googleapis.com`. To use a Gemini-compatible proxy (e.g. `https://api.grsai.ai`), paste the base URL here and use the matching provider's API key.
- Gemini may refuse some prompts or images; those items show an error tag and can be retried individually.
- Very large batches (~150 MB of outputs or more) trigger a warning and offer a sequential "Download each" fallback to avoid a slow ZIP pack.
- Aborting only cancels the client request — Google may still bill for any in-flight usage.
