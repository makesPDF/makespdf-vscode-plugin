# Changelog

## 0.2.1

- **Client header:** the extension now identifies itself as `vscode/<version>` in `X-MakesPDF-Client` (previously `vscode-plugin/<version>`), matching the plain client kinds the server recognises. Installed older versions are unaffected — the server keeps `vscode-plugin` as an alias.
- **Export stops when a local image cannot be embedded.** If a local image is missing, unreadable, or over the 5MB per-image limit, the extension no longer sends the request or writes a PDF — a file that looks finished but is missing an image is worse than no file. It shows an error that stays until dismissed, naming each failed reference (up to ten, then a count) and its reason, so you can fix or remove it and export again.

## 0.2.0

- **Report problem from a failed export.** Every export error message now has a **Report problem** button. It asks what went wrong and sends your message to makesPDF with a few facts about the failure (HTTP status, error code, page size, font settings, document size in bytes). Your Markdown and its file name are never sent.
- **New command: makesPDF: Send feedback.** Send a problem, an idea or praise from the Command Palette at any time.
- Feedback works without an API key. With `makespdf.apiToken` set, it is linked to your account. If sending fails, the error links to GitHub issues instead. See the README's "Sending feedback" section for exactly what is sent.

## 0.1.1

- **Local images now render.** Images referenced by a relative or absolute filesystem path — Markdown `![](./diagram.png)` or HTML image tags — are read from disk and inlined as base64 `data:` URIs before upload, so they appear in the PDF. Previously only `http(s)` images worked, because the server can't reach your filesystem. Remote URLs and existing `data:` URIs are left untouched, and image-like references inside code blocks/spans are never rewritten.

## 0.0.5

- **No signup required for short documents.** The extension now renders Markdown to PDF without an API token on its first run, via the server's anonymous-render path. Anonymous renders are rate-limited per IP (60/hour, 200/day) and capped at 20 pages per render.
- Provide a key in `makespdf.apiToken` to lift those limits and persist your renders to `makespdf.com/settings/renders`. The previous behaviour — prompting up-front for an API token on first run — is gone.
- Sends a `X-MakesPDF-Client: vscode-plugin/<version>` header so server-side analytics can attribute installs.
- Surfaces the server's sign-up nudge (`X-MakesPDF-Tip`) as a one-time toast per workspace after the first anonymous render.
- Improved error messages for 429 (rate-limited) and 400 `page-cap-exceeded` responses — they now include the server's `tip` text instead of the bare error code.
- Still 401s loudly on stale / invalid keys (no silent fall-through to anonymous), so a misconfigured key surfaces immediately rather than masquerading as a successful free render.

## 0.0.4

- Initial public release.
