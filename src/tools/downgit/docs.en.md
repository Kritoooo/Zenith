# DownGit

Download GitHub files or folders and package as a zip.

## Features
- Supports github.com / raw / API links
- Auto-detect file or directory
- Ref override (branch / tag / commit)
- Concurrent downloads with progress
- Custom output filename
- Optional GitHub token (private repos / rate limits)

## Steps
1. Paste a GitHub URL.
2. (Optional) Set Ref, output name, concurrency, or token.
3. Click Check to preview, then Download.
4. Folders are packaged as zip.

## Notes
- Uses GitHub API; rate limits may apply. Provide a token for private repos.
- Very large directories may be rejected.
- Tokens are stored only in the current browser session.
