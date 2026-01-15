# JSON Formatter

Format JSON as a readable tree or raw text, with minified output.

## Features
- Format: 2/4 space indentation
- Minify: single-line output
- Tree / Raw view toggle with size & node badges
- Adjustable text size
- Expand / collapse all nodes
- Large-payload guard: auto Raw fallback with optional force-render button
- One-click copy

## Steps
1. Paste JSON into Input.
2. Click Format or Minify.
3. Switch Tree or Raw in Output.
4. Adjust text size if needed; collapse Input to focus on Output.
5. Click Copy when needed.

## Notes
- Only standard JSON is supported (no comments or trailing commas).
- If clipboard is blocked, switch to Raw and copy manually.
- Tree view is skipped for payloads over ~120 KB or ~8,000 nodes; use Raw or Force Tree when needed.
