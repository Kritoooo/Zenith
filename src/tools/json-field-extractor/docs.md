# JSON Field Extractor

## Features
- Auto-detect field paths from JSON.
- Search and select detected paths with dot + bracket syntax.
- Post-process extracted values with an optional JavaScript snippet.
- Save multiple scripts locally and switch instantly.

## Steps
1. Paste JSON into the input panel.
2. Click Detect to scan and list available paths.
3. Search and select the paths you need, or add manual paths if required.
4. (Optional) Enable the script panel and open Scripts to manage saved scripts.
5. Save or switch scripts in the modal list.
6. Click Extract and copy the plain-text result.

## Notes
- Paths support `$` as the root alias.
- Use `[*]` to expand arrays.
- Script runs locally in the browser and receives `items`, `raw`, and `helpers`.
