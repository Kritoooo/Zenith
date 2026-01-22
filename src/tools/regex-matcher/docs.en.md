# Regex Matcher

Quickly validate regex patterns against text and reuse common presets.

## Features
- Define multiple field patterns with a list editor or text mode
- Output one row per match with comma-separated fields
- Optional script output for custom formatting
- Presets for URL, email, IPv4, dates, hex colors, and UUID
- Toggle JavaScript RegExp flags (g, i, m, s, u)

## Steps
1. Add fields in list mode or switch to text mode (`name,regex`).
2. Adjust flags as needed.
3. Paste text in Input to see matches.
4. Copy the output or enable Script for custom processing.

## Notes
- Patterns use JavaScript RegExp syntax without / / delimiters.
- Without the global flag, each field returns only the first match.
- Results are capped at 200 matches for performance.
