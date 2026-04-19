# Gemini Watermark Remover

Remove Gemini's visible bottom-right watermark in the browser without AI repainting.

## Features
- Runs reverse alpha blending locally in the browser
- Auto-selects the 48×48 or 96×96 Gemini watermark layout
- Optional manual override for 48×48 or 96×96 mode
- Side-by-side original and cleaned previews
- Exports PNG by default to avoid another lossy encode pass

## Steps
1. Upload or drag an image.
2. Keep Auto, or switch to 48×48 / 96×96 if needed.
3. Click Remove watermark to generate the result.
4. Click Download PNG to save it.

## Notes
- This only targets Gemini's visible watermark, not invisible watermarks such as SynthID.
- No AI inpaint or denoise is used; only mathematical reverse blending.
- Resized, recompressed, or screen-captured images may still show faint residual edges.

## Attribution
- Based on the reverse alpha blending approach from `allenk/GeminiWatermarkTool` (MIT).
