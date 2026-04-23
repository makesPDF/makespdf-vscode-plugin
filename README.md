# Markdown to PDF — VS Code Extension

Converts the active Markdown file to PDF using the makesPDF.com service.

## Links

- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin
- **Publisher hub:** https://marketplace.visualstudio.com/manage/publishers/Lecstor/extensions/makespdf-vscode-plugin/hub
- **Repository:** https://github.com/makesPDF/makespdf-vscode-plugin

## Features

- **Command palette:** "makesPDF from markdown"
- **Editor title bar:** PDF icon appears when viewing `.md` files
- **Right-click context menu:** available on `.md` files
- Opens the generated PDF in your system viewer (Preview.app on macOS)
- Saves the PDF alongside the source `.md` file

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `makespdf.serviceUrl` | `https://makespdf.com` | URL of the PDF service |
| `makespdf.apiToken` | `""` | API token sent as `Authorization: Bearer <token>`. Get one from [your API keys page](https://makespdf.com/settings/api-keys). |
| `makespdf.pageSize` | `A4` | A3, A4, A5, Letter, or Legal |
| `makespdf.fontFamily` | `Inter` | Inter or NotoSans |
| `makespdf.fontSize` | `10` | Font size in points (6–24) |
| `makespdf.margins` | `[40, 40, 40, 40]` | Page margins in points [top, right, bottom, left] |

## Development

### Prerequisites

The PDF service must be running locally:

```bash
# From the repo root
yarn dev
```

### Running in dev mode

1. Open this repo in VS Code
2. Press `Cmd+Shift+D` to open the Run and Debug sidebar
3. Select **"Run Extension"** from the dropdown at the top
4. Click the green play button (or press F5)

This builds the extension and opens a new VS Code window (the Extension Development Host) with the extension loaded. Open any `.md` file in that window to test.

### Live reload

For faster iteration, run the watch task instead of rebuilding each time:

1. Run `npm run watch` in a terminal
2. Make changes to `src/extension.ts`
3. In the Extension Development Host window, press `Cmd+Shift+P` > "Developer: Reload Window"

### Build commands

```bash
npm run build      # Bundle with esbuild
npm run watch      # Watch mode
npm run typecheck  # Type check
```

## Publishing

### One-time setup

1. Create a publisher account at https://marketplace.visualstudio.com/manage
2. Create a Personal Access Token (PAT) in Azure DevOps:
   - Go to https://dev.azure.com → User Settings → Personal Access Tokens
   - Create a token with **Marketplace > Manage** scope
   - Set the organization to "All accessible organizations"
3. Log in (vsce is installed as a devDependency, so no global install is needed):
   ```bash
   npm run login
   # Paste your PAT when prompted
   ```

### Publishing a release

```bash
# Build the extension
npm run build

# Package into a .vsix file (useful for testing before publishing)
npm run package

# Publish to the marketplace
npm run publish
```

To bump the version and publish in one step:

```bash
npm run publish:patch   # 0.0.1 → 0.0.2
npm run publish:minor   # 0.0.2 → 0.1.0
npm run publish:major   # 0.1.0 → 1.0.0
```

### Installing a .vsix locally

To test a packaged extension without publishing:

```bash
code --install-extension makespdf-vscode-plugin-0.0.1.vsix
```

Or in VS Code: Extensions sidebar > `...` menu > "Install from VSIX..."
