import * as vscode from "vscode";
import { writeFile } from "fs/promises";
import { basename, dirname, join } from "path";

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    "makespdf.convertMarkdownToPdf",
    convertMarkdownToPdf,
  );
  context.subscriptions.push(command);
}

export function deactivate() {}

async function convertMarkdownToPdf() {
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

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Converting to PDF...",
        cancellable: false,
      },
      async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown,
            options: { pageSize, fontFamily, fontSize, margins, title },
          }),
        });

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      vscode.window.showErrorMessage(
        `Could not connect to PDF service at ${serviceUrl}. Is it running? (yarn dev)`,
      );
    } else {
      vscode.window.showErrorMessage(`PDF conversion failed: ${message}`);
    }
  }
}
