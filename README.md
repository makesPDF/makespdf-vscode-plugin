# makesPDF — Markdown to PDF for VS Code

Turn the Markdown file you're editing into a cleanly typeset, accessible, archive-grade PDF with one command. Rendering runs on [makesPDF.com](https://makespdf.com) — no Chromium, no LaTeX, no local toolchain.

## Why makesPDF?

- **GitHub-Flavored Markdown in, styled PDF out.** Tables, fenced code blocks with syntax highlighting, task lists, nested lists, Mermaid diagrams, embedded images — all handled.
- **Nothing to install locally.** No headless browser, no native binaries, no font wrangling. If you have the extension and an internet connection, you can generate PDFs.
- **Millisecond renders.** A deterministic DSL pipeline renders a typical Markdown document in ~100ms — no AI in the hot path.
- **PDF/A-2A + PDF/UA-1 compliant.** Dual-compliant archival and accessible PDFs by default: full structure tree, embedded fonts, Unicode-correct text extraction. Safe for regulated industries, long-term storage, and screen readers.
- **Consistent output everywhere.** Same Markdown → same PDF on macOS, Windows, Linux, or CI. Bundled fonts (Inter, NotoSans) and a deterministic layout engine mean no more "works on my machine" PDFs.
- **Configurable page layout.** A3, A4, A5, Letter, Legal; per-side margins in points; font size 6–24pt.
- **API-first, so it grows with you.** The same service also powers invoices, quotes, CVs, statements, and LinkedIn carousels via a REST API designed for automation and AI agents. Bring your own AI (Claude, Cursor, ChatGPT, or any MCP-capable agent) to author templates once and render them on demand. See [makespdf.com/docs](https://makespdf.com/docs).

## Pricing

[makesPDF has a generous free tier.](https://makespdf.com/pricing) Short Markdown documents are free under the current promo, and the Free plan gives you 10 credits per month (roughly 100 pages) beyond that. PDFs on Free and Hobbyist plans include a small `makespdf.com` link at the bottom of the page — paid plans remove it.

## Getting started

1. **Install** the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin).
2. **Sign up** at [makespdf.com](https://makespdf.com) and create an API key at [makespdf.com/settings/api-keys](https://makespdf.com/settings/api-keys).
3. **Paste your key** into the `makespdf.apiToken` setting (VS Code will prompt you the first time you try to generate a PDF).
4. **Open any `.md` file** and run **makesPDF from markdown** — from the Command Palette, the PDF icon in the editor title bar, or the right-click menu.

The generated PDF is saved next to your source file and opened in your system viewer.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `makespdf.serviceUrl` | `https://makespdf.com` | URL of the PDF service. Change this only if you're running makesPDF self-hosted. |
| `makespdf.apiToken` | `""` | API token sent as `Authorization: Bearer <token>`. Get one at [makespdf.com/settings/api-keys](https://makespdf.com/settings/api-keys). |
| `makespdf.pageSize` | `A4` | A3, A4, A5, Letter, or Legal. |
| `makespdf.fontFamily` | `Inter` | Inter or NotoSans. |
| `makespdf.fontSize` | `10` | Font size in points (6–24). |
| `makespdf.margins` | `[40, 40, 40, 40]` | Page margins in points `[top, right, bottom, left]`. |

## Links

- **Website:** https://makespdf.com
- **API docs:** https://makespdf.com/docs
- **Marketplace listing:** https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin
- **Source / issues:** https://github.com/makesPDF/makespdf-vscode-plugin

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, build commands, and publishing instructions.

## License

[MIT](./LICENSE)
