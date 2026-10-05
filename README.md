# makesPDF — Markdown to PDF for VS Code

Turn the Markdown file you're editing into a cleanly typeset, accessible, archive-grade PDF with one command. Rendering runs on [makesPDF.com](https://makespdf.com) — no Chromium, no LaTeX, no local toolchain.

## Why makesPDF?

- **GitHub-Flavored Markdown in, styled PDF out.** Tables, fenced code blocks with syntax highlighting, task lists, nested lists, Mermaid diagrams, embedded images — all handled.
- **Nothing to install locally.** No headless browser, no native binaries, no font wrangling. If you have the extension and an internet connection, you can generate PDFs.
- **Millisecond renders.** A deterministic DSL pipeline renders a typical Markdown document in ~100ms — no AI in the hot path.
- **PDF/A-2A + PDF/UA-1 compliant.** Dual-compliant archival and accessible PDFs by default: full structure tree, embedded fonts, Unicode-correct text extraction. Safe for regulated industries, long-term storage, and screen readers.
- **Consistent output everywhere.** Same Markdown → same PDF on macOS, Windows, Linux, or CI. Bundled fonts (Inter, NotoSans) and a deterministic layout engine mean no more "works on my machine" PDFs.
- **Configurable page layout.** A3, A4, A5, Letter, Legal; per-side margins in points; font size 6–24pt.
- **API-first, so it grows with you.** The same service also powers invoices, quotes, CVs, and statements via a REST API designed for automation and AI agents. Bring your own AI (Claude, Cursor, ChatGPT, or any MCP-capable agent) to author templates once and render them on demand. See [makespdf.com/docs](https://makespdf.com/docs).

## Getting started

1. **Install** the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin).
2. **Open any `.md` file** and run **makesPDF from markdown** — from the Command Palette, the PDF icon in the editor title bar, or the right-click menu.

That's it. The generated PDF is saved next to your source file and opened in your system viewer.

Using a VS Code-based editor that doesn't use the Microsoft Marketplace? Cursor, Windsurf, VSCodium and other forks install the extension from [Open VSX](https://open-vsx.org/extension/Lecstor/makespdf-vscode-plugin).

Documents up to 20 pages render out of the box, rate-limited to 60/hour and 200/day per IP. For longer documents and higher limits, add an API key from [makespdf.com/settings/api-keys](https://makespdf.com/settings/api-keys) to the `makespdf.apiToken` setting (Cmd/Ctrl + , → search "makespdf"). With a key configured, renders go through your account: no per-IP limit, no per-render page cap (other than the 200KB Markdown input cap), and your PDFs are persisted to `makespdf.com/settings/renders` for re-download.

**Local images are embedded on export.** An image referenced by a relative or absolute filesystem path (`![diagram](./diagram.png)` or an HTML image tag) is read from disk and embedded as a `data:` URI before upload, so the service can render it without filesystem access. If any local image cannot be embedded — the file is missing or unreadable, or larger than 5MB — the export stops without writing a PDF and an error dialog names each failed reference, so you can fix or remove it and export again. `http(s)` URLs are left for the service to fetch.

See [makespdf.com/pricing](https://makespdf.com/pricing) for plan details. PDFs on the Free and Hobbyist plans include a small `makespdf.com` link at the bottom of the page — paid plans remove it.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `makespdf.serviceUrl` | `https://makespdf.com` | URL of the PDF service. Change this only if you're running makesPDF self-hosted. |
| `makespdf.apiToken` | `""` | Optional. Leave blank for the default per-IP limits (60/hour, 200/day, 20 pages per render). Paste a key to lift the limits and persist renders. Get one at [makespdf.com/settings/api-keys](https://makespdf.com/settings/api-keys). |
| `makespdf.pageSize` | `A4` | A3, A4, A5, Letter, or Legal. |
| `makespdf.fontFamily` | `Inter` | Inter or NotoSans. |
| `makespdf.fontSize` | `10` | Font size in points (6–24). |
| `makespdf.margins` | `[40, 40, 40, 40]` | Page margins in points `[top, right, bottom, left]`. |

## Sending feedback

When an export fails, the error message has a **Report problem** button. You can also run **makesPDF: Send feedback** from the Command Palette at any time to send a problem, an idea or praise.

Feedback is sent to makesPDF (`POST /api/v1/feedback` on your `makespdf.serviceUrl`) and read by the makesPDF team. Each message contains:

- the text you type (please don't paste document content into it);
- the kind you picked: problem, idea or praise;
- for **Report problem** only, a few facts about the failed export: the HTTP status, the server's error code if it returned one, your page size, font family and font size settings, and the size of the document in bytes;
- the extension's name and version (`X-MakesPDF-Client`), and your API key if you have set `makespdf.apiToken`, so the feedback is linked to your account. Without a key, or if the server rejects your key, it is sent anonymously.

Your Markdown, its file name and its path are never sent with feedback. The service stores your message with a daily-salted hash of your IP address and your country code, and keeps it until the makesPDF team deletes it. Your IP address is also used, unhashed, for rate limiting. If sending fails, the error message links to [GitHub issues](https://github.com/makesPDF/makespdf-vscode-plugin/issues) instead.

## Links

- **Website:** https://makespdf.com
- **API docs:** https://makespdf.com/docs
- **Marketplace listing:** https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin
- **Source / issues:** https://github.com/makesPDF/makespdf-vscode-plugin

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, build commands, and publishing instructions.

## License

[MIT](./LICENSE)
