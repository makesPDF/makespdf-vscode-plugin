# Changelog

## 0.1.1

- **Local images now render.** Images referenced by a relative or absolute filesystem path — Markdown `![](./diagram.png)` or HTML image tags — are read from disk and inlined as base64 `data:` URIs before upload, so they appear in the PDF. Previously only `http(s)` images worked, because the server can't reach your filesystem. Remote URLs and existing `data:` URIs are left untouched, and image-like references inside code blocks/spans are never rewritten. If a referenced file can't be read, the reference is left as-is and a non-blocking warning lists what was skipped.

## 0.0.5

- **No signup required for short documents.** The extension now renders Markdown to PDF without an API token on its first run, via the server's anonymous-render path. Anonymous renders are rate-limited per IP (60/hour, 200/day) and capped at 20 pages per render.
- Provide a key in `makespdf.apiToken` to lift those limits and persist your renders to `makespdf.com/settings/renders`. The previous behaviour — prompting up-front for an API token on first run — is gone.
- Sends a `X-MakesPDF-Client: vscode-plugin/<version>` header so server-side analytics can attribute installs.
- Surfaces the server's sign-up nudge (`X-MakesPDF-Tip`) as a one-time toast per workspace after the first anonymous render.
- Improved error messages for 429 (rate-limited) and 400 `page-cap-exceeded` responses — they now include the server's `tip` text instead of the bare error code.
- Still 401s loudly on stale / invalid keys (no silent fall-through to anonymous), so a misconfigured key surfaces immediately rather than masquerading as a successful free render.

## 0.0.4

- Initial public release.
