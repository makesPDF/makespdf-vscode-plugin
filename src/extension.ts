import * as vscode from "vscode";
import { writeFile } from "fs/promises";
import { basename, dirname, join } from "path";

const VERSION = "0.0.5";
const ANON_TIP_SEEN_KEY = "makespdf.anonTipSeen";

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    "makespdf.convertMarkdownToPdf",
    () => convertMarkdownToPdf(context),
  );
  context.subscriptions.push(command);
}

export function deactivate() {}

async function convertMarkdownToPdf(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  if (editor.document.languageId !== "markdown") {
    vscode.window.showWarningMessage("Active file is not a Markdown document");
    return;
  }

  const markdown = editor.document.getText();
  if (!markdown.trim()) {
    vscode.window.showWarningMessage("Document is empty");
    return;
  }

  const config = vscode.workspace.getConfiguration("makespdf");
  const serviceUrl = config.get<string>("serviceUrl", "https://makespdf.com");
  const apiToken = config.get<string>("apiToken", "").trim();
  const pageSize = config.get<string>("pageSize", "A4");
  const fontFamily = config.get<string>("fontFamily", "Inter");
  const fontSize = config.get<number>("fontSize", 10);
  const margins = config.get<number[]>("margins", [40, 40, 40, 40]);

  // Derive title from filename
  const mdFilename = editor.document.uri.fsPath;
  const title = basename(mdFilename, ".md");

  const url = `${serviceUrl.replace(/\/+$/, "")}/api/v1/md`;

  const pdfPath = join(dirname(mdFilename), `${title}.pdf`);
  let savedMessage = "";
  let anonymousTip: string | null = null;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Converting to PDF...",
        cancellable: false,
      },
      async () => {
        // Build headers. Omit Authorization when no key is configured so
        // the server can take the anonymous path; sending an empty
        // `Bearer ` would otherwise be treated as a failed auth attempt
        // and return 401.
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-MakesPDF-Client": `vscode-plugin/${VERSION}`,
        };
        if (apiToken) {
          headers.Authorization = `Bearer ${apiToken}`;
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            markdown,
            options: { pageSize, fontFamily, fontSize, margins, title },
          }),
        });

        if (response.status === 401 || response.status === 403) {
          // 401 means the *server* rejected — either we sent a stale key
          // (the user needs to fix it) or anonymous renders aren't
          // enabled on this server (the user needs an account).
          if (apiToken) {
            throw new AuthError(
              "Authentication failed. Check `makespdf.apiToken` in your settings.",
            );
          }
          throw new AuthError(
            "This server requires an account. Create one at " +
              `${serviceUrl.replace(/\/+$/, "")}/signup and paste your API key into the ` +
              "`makespdf.apiToken` setting.",
          );
        }

        if (response.status === 429) {
          const detail = await readErrorTip(response);
          throw new Error(
            `Rate limited. ${detail.tip ?? "Wait a few minutes and try again, or sign up for higher limits."}`,
          );
        }

        if (response.status === 400) {
          const detail = await readErrorTip(response);
          // page-cap-exceeded is the only 400 with structured guidance.
          if (detail.error === "page-cap-exceeded") {
            throw new Error(
              `Document is too long for an anonymous render (${detail.actual ?? "many"} pages, ` +
                `cap ${detail.limit ?? 20}). ${detail.tip ?? "Sign up for higher limits."}`,
            );
          }
          throw new Error(detail.error ?? "Bad request");
        }

        if (!response.ok) {
          const errorBody = await response.text();
          let detail: string;
          try {
            detail = JSON.parse(errorBody).error ?? errorBody;
          } catch {
            detail = errorBody;
          }
          throw new Error(detail);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(pdfPath, buffer);

        const pages = response.headers.get("X-Pages");
        const ms = response.headers.get("X-Render-Ms");
        const stats = [
          pages && `${pages} page${pages === "1" ? "" : "s"}`,
          ms && `${ms}ms`,
        ]
          .filter(Boolean)
          .join(", ");

        savedMessage = `PDF saved: ${basename(pdfPath)}${stats ? ` (${stats})` : ""}`;

        // Capture the server's upsell hint when we rendered without a
        // key. Shown once per workspace as a follow-up info message.
        if (!apiToken) {
          anonymousTip = response.headers.get("X-MakesPDF-Tip");
        }
      },
    );

    // Show actions outside withProgress so the spinner dismisses immediately
    const action = await vscode.window.showInformationMessage(
      savedMessage,
      "Open PDF",
      "Reveal in Finder",
    );

    if (action === "Open PDF") {
      await vscode.env.openExternal(vscode.Uri.file(pdfPath));
    } else if (action === "Reveal in Finder") {
      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(pdfPath),
      );
    }

    // Surface the anonymous-tier upsell once per workspace.
    if (anonymousTip && !context.workspaceState.get<boolean>(ANON_TIP_SEEN_KEY)) {
      await context.workspaceState.update(ANON_TIP_SEEN_KEY, true);
      const choice = await vscode.window.showInformationMessage(
        `Rendered without an account. ${anonymousTip}`,
        "Sign up",
        "Maybe later",
      );
      if (choice === "Sign up") {
        await vscode.env.openExternal(
          vscode.Uri.parse(`${serviceUrl.replace(/\/+$/, "")}/signup`),
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (error instanceof AuthError) {
      const action = await vscode.window.showErrorMessage(
        message,
        "Get API Key",
        "Open Settings",
      );
      const apiKeysUrl = `${serviceUrl.replace(/\/+$/, "")}/settings/api-keys`;
      if (action === "Get API Key") {
        await vscode.env.openExternal(vscode.Uri.parse(apiKeysUrl));
      } else if (action === "Open Settings") {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "makespdf.apiToken",
        );
      }
      return;
    }

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      vscode.window.showErrorMessage(
        `Could not connect to PDF service at ${serviceUrl}. Is it running? (yarn dev)`,
      );
    } else {
      vscode.window.showErrorMessage(`PDF conversion failed: ${message}`);
    }
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

interface ErrorDetail {
  error?: string;
  tip?: string;
  limit?: number;
  actual?: number;
}

async function readErrorTip(response: Response): Promise<ErrorDetail> {
  try {
    const body = (await response.json()) as ErrorDetail;
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
