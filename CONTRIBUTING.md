# Contributing

Thanks for helping out. This file covers local development, building and testing.

## Prerequisites

The extension talks to the hosted service at `https://makespdf.com` by default, and that is what development uses. Without an API key, renders are anonymous and limited to 60 per hour, 200 per day and 20 pages per render. For more, add a key from [makespdf.com/settings/api-keys](https://makespdf.com/settings/api-keys) to the `makespdf.apiToken` setting in the Extension Development Host.

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
npm test           # Unit tests (node --test; needs Node 22.18+ for built-in TypeScript support)
```

## Releases

The maintainers publish releases to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin) from a version tag. The [Publish workflow](.github/workflows/publish.yml) runs the typecheck and tests, packages the `.vsix` and publishes it with Marketplace Trusted Publishing, so no publishing token is stored. Pull requests don't need to bump the version.

## Installing a .vsix locally

To build a package and try it without publishing:

```bash
npm run package
code --install-extension makespdf-vscode-plugin-<version>.vsix
```

Or in VS Code: Extensions sidebar → `...` menu → **Install from VSIX...**
