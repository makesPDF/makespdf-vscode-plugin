# Contributing

Thanks for helping out. This file covers local development, building, and publishing.

## Prerequisites

The PDF service can be pointed at either production (`https://makespdf.com`, the default) or a local instance of the [makesPDF](https://github.com/makesPDF/makesPDF) backend. For most extension work, production is fine — you just need an API key.

If you're working on changes that require local backend changes too, run the service locally from the sibling `makesPDF` repo:

```bash
# From the makesPDF repo root
yarn dev   # serves on http://localhost:8788
```

Then point the extension at it by setting `makespdf.serviceUrl` to `http://localhost:8788` in your VS Code settings.

## Running in dev mode

1. Open this repo in VS Code.
2. Press `Cmd+Shift+D` to open the Run and Debug sidebar.
3. Select **Run Extension** from the dropdown at the top.
4. Click the green play button (or press `F5`).

This builds the extension and opens a new VS Code window (the Extension Development Host) with the extension loaded. Open any `.md` file in that window to test.

### Live reload

For faster iteration, run the watch task instead of rebuilding manually:

1. Run `npm run watch` in a terminal.
2. Make changes to `src/extension.ts`.
3. In the Extension Development Host window, press `Cmd+Shift+P` and run **Developer: Reload Window**.

## Build commands

```bash
npm run build      # Bundle with esbuild
npm run watch      # Watch mode
npm run typecheck  # Type check (tsc --noEmit)
```

## Publishing

The extension is published to the VS Code Marketplace under the **Lecstor** publisher.

### One-time setup

1. Make sure you have publish rights on the Lecstor publisher at https://marketplace.visualstudio.com/manage.
2. Create a Personal Access Token (PAT) in Azure DevOps:
   - Go to https://dev.azure.com → User Settings → Personal Access Tokens.
   - Create a token with **Marketplace > Manage** scope.
   - Set the organization to **All accessible organizations**.
3. Log in (vsce is installed as a devDependency, so no global install needed):
   ```bash
   npm run login
   # Paste your PAT when prompted
   ```

### Publishing a release

The `vscode:prepublish` hook runs `npm run build` automatically before packaging, so you don't need to build manually.

```bash
# Package into a .vsix file (optional — useful for testing before publishing)
npm run package

# Publish to the Marketplace
npm run publish
```

To bump the version and publish in one step:

```bash
npm run publish:patch   # 0.0.1 → 0.0.2
npm run publish:minor   # 0.0.2 → 0.1.0
npm run publish:major   # 0.1.0 → 1.0.0
```

Each variant runs `vsce publish <bump> --no-dependencies`, which updates `package.json`, creates a git commit and tag, and uploads the new `.vsix`.

### Installing a .vsix locally

To test a packaged extension without publishing:

```bash
code --install-extension makespdf-vscode-plugin-<version>.vsix
```

Or in VS Code: Extensions sidebar → `...` menu → **Install from VSIX...**
