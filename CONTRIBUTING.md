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

The extension is published under the **Lecstor** publisher with the extension ID `Lecstor.makespdf-vscode-plugin`:

- the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Lecstor.makespdf-vscode-plugin), which VS Code itself uses. GitHub Actions publishes each release there.
- [Open VSX](https://open-vsx.org/extension/Lecstor/makespdf-vscode-plugin), which VS Code-based editors that don't use the Microsoft Marketplace (Cursor, Windsurf, VSCodium and others) install from. The extension is not on Open VSX yet. Publishing there is a manual step, described below.

### One-time setup: VS Code Marketplace

[`.github/workflows/publish.yml`](.github/workflows/publish.yml) publishes with [Marketplace Trusted Publishing](https://code.visualstudio.com/docs/extensions/publish-extension): the job's GitHub OIDC token is exchanged for a Marketplace credential that lasts 15 minutes, so no Personal Access Token is stored anywhere. Azure DevOps retires global Personal Access Tokens on 1 December 2026, and the old `vsce login` flow stops working on that date.

The workflow needs one policy on the publisher:

1. Open https://marketplace.visualstudio.com/manage, select the **Lecstor** publisher, then **Trusted Publishing**.
2. Create a policy with repository owner `makesPDF`, repository `makespdf-vscode-plugin`, workflow `publish.yml`, and an empty environment.

### Publishing a release

1. On a branch, bump the version and open a PR into `main`:
   ```bash
   npm version patch --no-git-tag-version   # or: minor / major
   ```
   This updates `package.json` and `package-lock.json`. Merge the PR.
2. Tag the merge commit and push the tag:
   ```bash
   git fetch origin
   git tag v<version> origin/main
   git push origin v<version>
   ```

The tag push runs the **Publish** workflow. It fails without publishing if the tag does not match the `package.json` version. Otherwise it runs the typecheck and tests, packages the `.vsix` (the `vscode:prepublish` hook runs the build), publishes it with `vsce publish --oidc`, and uploads the same `.vsix` as the run's `vsix` artifact.

### Open VSX (manual)

One-time setup:

1. Create an [Eclipse Foundation account](https://accounts.eclipse.org) and set your GitHub username on it — Open VSX uses Eclipse accounts, and namespace ownership is granted through the linked GitHub account.
2. Sign in at https://open-vsx.org with that account and sign the Publisher Agreement.
3. Claim the **`Lecstor`** namespace at https://open-vsx.org/user-settings/namespaces. It must match `"publisher"` in `package.json`.
4. Create an access token at https://open-vsx.org/user-settings/tokens and save it in 1Password: **makesPDF** vault, item **"Open VS X Access Token"**, in the item's `credential` field. Publishing reads it with the [1Password CLI](https://developer.1password.com/docs/cli/) (`op`) — the token is never written to a file or script.

To publish a release, download the `vsix` artifact from that release's Publish run, put `makespdf-vscode-plugin-<version>.vsix` in the repo root, and run:

```bash
OVSX_PAT=$(op read "op://makesPDF/Open VS X Access Token/credential") npm run publish:ovsx
```

### Installing a .vsix locally

To test a packaged extension without publishing:

```bash
code --install-extension makespdf-vscode-plugin-<version>.vsix
```

Or in VS Code: Extensions sidebar → `...` menu → **Install from VSIX...**
