# Prompt Manager

Organize reusable prompt templates, fill variables, and generate copy-ready output.

## Features
- Manage prompt entries (create, duplicate, delete)
- Pin important prompts to keep them at the top
- Add tags and filter prompts by tag
- Detect variables in `{{variable_name}}` format
- Fill variables and preview rendered prompt output
- Keep per-prompt snapshot history and restore previous versions
- Import and export prompt libraries as JSON

## Steps
1. Click `Create` to add a new prompt.
2. Edit title, tags, and prompt content in the editor panel.
3. Add variables in `{{name}}` format, then fill values in the variable panel.
4. Copy either the original prompt or the rendered preview.
5. Use `Import` / `Export` to move prompt libraries across devices.

## Notes
- Data is stored in browser local storage.
- Variable placeholders are kept if no value is provided.
- Import accepts either an array of prompts or an object with a `prompts` field.
