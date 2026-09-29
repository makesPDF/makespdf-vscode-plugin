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
npm test           # Unit tests (node --test; needs Node 22.18+ for built-in TypeScript support)
```

## Publishing

The extension is published under the **Lecstor** publisher to two registries, with the same extension ID (`Lecstor.makespdf-vscode-plugin`) on both:

- the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin), which VS Code itself uses;
- [Open VSX](https://open-vsx.org/extension/Lecstor/makespdf-vscode-plugin), which VS Code-based editors that don't use the Microsoft Marketplace — Cursor, Windsurf, VSCodium and others — install from.

Publishing is a local, manual step — there is no CI publish workflow. A release packages one `.vsix` and publishes that same file to both registries.

### One-time setup: VS Code Marketplace

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

### One-time setup: Open VSX

1. Create an [Eclipse Foundation account](https://accounts.eclipse.org) and set your GitHub username on it — Open VSX uses Eclipse accounts, and namespace ownership is granted through the linked GitHub account.
2. Sign in at https://open-vsx.org with that account and sign the Publisher Agreement.
3. Claim the **`Lecstor`** namespace at https://open-vsx.org/user-settings/namespaces. It must match `"publisher"` in `package.json`.
4. Create an access token at https://open-vsx.org/user-settings/tokens and save it in 1Password: **makesPDF** vault, item **"Open VS X Access Token"**, in the item's `credential` field. Publishing reads it with the [1Password CLI](https://developer.1password.com/docs/cli/) (`op`) — the token is never written to a file or script.

### Publishing a release

The `vscode:prepublish` hook runs `npm run build` automatically before packaging, so you don't need to build manually.

```bash
# 1. Bump the version (updates package.json, creates a git commit and tag)
npm version patch   # or: npm version minor / npm version major

# 2. Package once
npm run package

# 3. Publish that same .vsix to both registries
npm run publish:marketplace
OVSX_PAT=$(op read "op://makesPDF/Open VS X Access Token/credential") npm run publish:ovsx

# 4. Push the version commit and tag so the repo matches the registries
git push origin main --follow-tags
```

`npm run publish:both` does steps 2 and 3 in one command: `npm run package` once, then the same `makespdf-vscode-plugin-<version>.vsix` to both registries. Export the Open VSX token first so the chained commands can read it:

```bash
export OVSX_PAT=$(op read "op://makesPDF/Open VS X Access Token/credential")
npm run publish:both
```

The older `npm run publish` and the `publish:patch` / `publish:minor` / `publish:major` variants publish **to the Marketplace only** — `vsce publish <bump> --no-dependencies` repackages, updates `package.json`, creates a git commit and tag, and uploads. For a release on both registries, use the sequence above.

### Installing a .vsix locally

To test a packaged extension without publishing:

```bash
code --install-extension makespdf-vscode-plugin-<version>.vsix
```

Or in VS Code: Extensions sidebar → `...` menu → **Install from VSIX...**
