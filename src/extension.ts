import * as vscode from "vscode";
import { readFile, writeFile } from "fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "path";
import {
  buildProblemContext,
  CLIENT_NAME,
  sendFeedback,
  validateFeedbackMessage,
  type FeedbackContext,
  type FeedbackKind,
  type RenderFailureFacts,
} from "./feedback";

const ANON_TIP_SEEN_KEY = "makespdf.anonTipSeen";

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    "makespdf.convertMarkdownToPdf",
    () => convertMarkdownToPdf(context),
  );
  context.subscriptions.push(command);
  context.subscriptions.push(
    vscode.commands.registerCommand("makespdf.sendFeedback", () =>
      sendFeedbackCommand(context),
    ),
  );
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
  // Fingerprints for "Report problem": sizes and settings, never the text or
  // the file name. The failure's status and code are added in the catch.
  const failureFacts: RenderFailureFacts = {
    pageSize,
    fontFamily,
    fontSize,
    inputBytes: Buffer.byteLength(markdown),
  };
  let savedMessage = "";
  let anonymousTip: string | null = null;
  let imageNotice: string | null = null;

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
        // Read the version from our own package.json at runtime so it tracks
        // whatever `vsce publish` bumped — no hand-maintained constant to drift.
        const version = context.extension.packageJSON.version as string;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-MakesPDF-Client": `${CLIENT_NAME}/${version}`,
        };
        if (apiToken) {
          headers.Authorization = `Bearer ${apiToken}`;
        }

        // Inline images referenced by local path so they survive the trip
        // to the server, which can only fetch http(s) URLs — it has no
        // access to the user's filesystem. Remote URLs and existing data
        // URIs are left untouched.
        const { markdown: markdownToSend, failures } = await inlineLocalImages(
          markdown,
          dirname(mdFilename),
        );
        if (failures.length) {
          const head = failures.slice(0, 3).join(", ");
          imageNotice =
            `Could not read ${failures.length} local image` +
            `${failures.length === 1 ? "" : "s"}: ${head}` +
            `${failures.length > 3 ? "…" : ""}. They were left as-is.`;
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            markdown: markdownToSend,
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
              response.status,
            );
          }
          throw new AuthError(
            "This server requires an account. Create one at " +
              `${serviceUrl.replace(/\/+$/, "")}/signup and paste your API key into the ` +
              "`makespdf.apiToken` setting.",
            response.status,
          );
        }

        if (response.status === 429) {
          const detail = await readErrorTip(response);
          throw new RenderError(
            `Rate limited. ${detail.tip ?? "Wait a few minutes and try again, or sign up for higher limits."}`,
            response.status,
            detail.error,
          );
        }

        if (response.status === 400) {
          const detail = await readErrorTip(response);
          // page-cap-exceeded is the only 400 with structured guidance.
          if (detail.error === "page-cap-exceeded") {
            throw new RenderError(
              `Document is too long for an anonymous render (${detail.actual ?? "many"} pages, ` +
                `cap ${detail.limit ?? 20}). ${detail.tip ?? "Sign up for higher limits."}`,
              response.status,
              detail.error,
            );
          }
          throw new RenderError(detail.error ?? "Bad request", response.status, detail.error);
        }

        if (!response.ok) {
          const errorBody = await response.text();
          let detail: string;
          let code: unknown;
          try {
            code = JSON.parse(errorBody).error;
            detail = typeof code === "string" && code ? code : errorBody;
          } catch {
            detail = errorBody;
          }
          throw new RenderError(detail, response.status, code);
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

    // Warn about any local images we couldn't read (non-blocking — the PDF
    // still rendered, those references just won't show an image).
    if (imageNotice) {
      vscode.window.showWarningMessage(imageNotice);
    }

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
    if (error instanceof RenderError || error instanceof AuthError) {
      failureFacts.httpStatus = error.status;
    }
    if (error instanceof RenderError) {
      failureFacts.errorCode = typeof error.code === "string" ? error.code : undefined;
    }

    if (error instanceof AuthError) {
      const action = await vscode.window.showErrorMessage(
        message,
        "Get API Key",
        "Open Settings",
        REPORT_PROBLEM,
      );
      const apiKeysUrl = `${serviceUrl.replace(/\/+$/, "")}/settings/api-keys`;
      if (action === "Get API Key") {
        await vscode.env.openExternal(vscode.Uri.parse(apiKeysUrl));
      } else if (action === "Open Settings") {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "makespdf.apiToken",
        );
      } else if (action === REPORT_PROBLEM) {
        await reportProblem(context, failureFacts);
      }
      return;
    }

    const shown =
      message.includes("ECONNREFUSED") || message.includes("fetch failed")
        ? `Could not connect to PDF service at ${serviceUrl}. Is it running? (yarn dev)`
        : `PDF conversion failed: ${message}`;
    const action = await vscode.window.showErrorMessage(shown, REPORT_PROBLEM);
    if (action === REPORT_PROBLEM) {
      await reportProblem(context, failureFacts);
    }
  }
}

const REPORT_PROBLEM = "Report problem";
const PROBLEM_PROMPT = "What went wrong? Please don't paste document content.";
const ISSUES_URL = "https://github.com/makesPDF/makespdf-vscode-plugin/issues";

/** "Report problem" on a failed export: ask for a message, send it with fingerprints. */
async function reportProblem(
  context: vscode.ExtensionContext,
  facts: RenderFailureFacts,
) {
  const message = await askForMessage(PROBLEM_PROMPT);
  if (message === undefined) return;
  await submitFeedback(context, "problem", message, buildProblemContext(facts));
}

const FEEDBACK_KINDS: (vscode.QuickPickItem & { feedbackKind: FeedbackKind; prompt: string })[] = [
  {
    label: "Problem",
    description: "Something went wrong",
    feedbackKind: "problem",
    prompt: PROBLEM_PROMPT,
  },
  {
    label: "Idea",
    description: "Something you'd like makesPDF to do",
    feedbackKind: "idea",
    prompt: "What would you like? Please don't paste document content.",
  },
  {
    label: "Praise",
    description: "Something that works well",
    feedbackKind: "praise",
    prompt: "What's working well for you?",
  },
];

/** The "makesPDF: Send feedback" command. Sends no `context`. */
async function sendFeedbackCommand(context: vscode.ExtensionContext) {
  const picked = await vscode.window.showQuickPick(FEEDBACK_KINDS, {
    title: "makesPDF: Send feedback",
    placeHolder: "What kind of feedback?",
  });
  if (!picked) return;
  const message = await askForMessage(picked.prompt);
  if (message === undefined) return;
  await submitFeedback(context, picked.feedbackKind, message);
}

function askForMessage(prompt: string): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "makesPDF feedback",
    prompt,
    ignoreFocusOut: true,
    validateInput: (value) => validateFeedbackMessage(value),
  });
}

async function submitFeedback(
  context: vscode.ExtensionContext,
  kind: FeedbackKind,
  message: string,
  feedbackContext?: FeedbackContext,
) {
  const config = vscode.workspace.getConfiguration("makespdf");
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Sending feedback..." },
    () =>
      sendFeedback({
        serviceUrl: config.get<string>("serviceUrl", "https://makespdf.com"),
        version: context.extension.packageJSON.version as string,
        apiToken: config.get<string>("apiToken", "").trim(),
        kind,
        message,
        context: feedbackContext,
      }),
  );

  if (result.status === "sent") {
    vscode.window.showInformationMessage("Thanks, feedback sent.");
  } else if (result.status === "rate-limited") {
    vscode.window.showWarningMessage("Too many feedback messages, try again later.");
  } else {
    const action = await vscode.window.showErrorMessage(
      `Could not send feedback: ${result.error}. You can open a GitHub issue instead.`,
      "Open GitHub issues",
    );
    if (action === "Open GitHub issues") {
      await vscode.env.openExternal(vscode.Uri.parse(ISSUES_URL));
    }
  }
}

class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** A non-2xx render response: the status and the body's `error` value, for feedback context. */
class RenderError extends Error {
  readonly status: number;
  readonly code: unknown;
  constructor(message: string, status: number, code: unknown) {
    super(message);
    this.name = "RenderError";
    this.status = status;
    this.code = code;
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

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".apng": "image/apng",
};

// Markdown image: ![alt](src "optional title"). Group 2 is the src (possibly
// wrapped in <…>); group 3 is the optional title with its leading whitespace.
const MD_IMAGE =
  /!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)((?:\s+(?:"[^"]*"|'[^']*'))?)\s*\)/g;
// HTML <img …src="…">. Group 1 is everything up to and including `src=`,
// group 3/4 is the quoted value (double/single).
const HTML_IMAGE_SRC = /(<img\b[^>]*?\bsrc\s*=\s*)("([^"]*)"|'([^']*)')/gi;

interface InlineResult {
  markdown: string;
  failures: string[];
}

/**
 * Replace local image references in `source` with base64 `data:` URIs read
 * from disk, resolving relative paths against `baseDir`. Remote URLs (http,
 * https, data, file, protocol-relative), unknown extensions, and references
 * inside code blocks/spans are left untouched. Unreadable paths are reported
 * in `failures` and left as-is.
 */
async function inlineLocalImages(
  source: string,
  baseDir: string,
): Promise<InlineResult> {
  // Protect code so we never rewrite image-like text inside fenced blocks or
  // inline spans (where it's literal text the user wants to see verbatim).
  const { masked, restore } = maskCode(source);

  const srcs = new Set<string>();
  for (const m of masked.matchAll(MD_IMAGE)) srcs.add(cleanSrc(m[2]));
  for (const m of masked.matchAll(HTML_IMAGE_SRC)) {
    srcs.add(cleanSrc(m[3] ?? m[4] ?? ""));
  }

  const dataUris = new Map<string, string>();
  const failures: string[] = [];
  await Promise.all(
    [...srcs].map(async (src) => {
      if (!isInlinableLocalSrc(src)) return;
      const mime = IMAGE_MIME_BY_EXT[extname(src).toLowerCase()];
      if (!mime) return; // not a recognised image extension — leave untouched
      try {
        const bytes = await readFile(toFsPath(src, baseDir));
        dataUris.set(src, `data:${mime};base64,${bytes.toString("base64")}`);
      } catch {
        failures.push(src);
      }
    }),
  );

  if (dataUris.size === 0) return { markdown: source, failures };

  let out = masked.replace(MD_IMAGE, (whole, alt, url, title) => {
    const uri = dataUris.get(cleanSrc(url));
    return uri ? `![${alt}](${uri}${title ?? ""})` : whole;
  });
  out = out.replace(HTML_IMAGE_SRC, (whole, prefix, _quoted, dq, sq) => {
    const uri = dataUris.get(cleanSrc(dq ?? sq ?? ""));
    if (!uri) return whole;
    const quote = dq !== undefined ? '"' : "'";
    return `${prefix}${quote}${uri}${quote}`;
  });

  return { markdown: restore(out), failures };
}

/** Strip surrounding <…> angle brackets and whitespace from a src token. */
function cleanSrc(raw: string): string {
  const s = raw.trim();
  return s.startsWith("<") && s.endsWith(">") ? s.slice(1, -1).trim() : s;
}

/**
 * Whether a src is a local path we should inline. Skips anything with a URL
 * scheme of two or more characters (http:, https:, data:, file:) so that
 * Windows drive paths like `C:\img.png` are still treated as local, plus
 * protocol-relative (`//host/x`) and fragment-only refs.
 */
function isInlinableLocalSrc(src: string): boolean {
  if (!src) return false;
  if (/^[a-z][a-z0-9+.-]+:/i.test(src)) return false;
  if (src.startsWith("//") || src.startsWith("#")) return false;
  return true;
}

/** Resolve a (possibly percent-encoded) src to an absolute filesystem path. */
function toFsPath(src: string, baseDir: string): string {
  let p = src;
  try {
    p = decodeURIComponent(src);
  } catch {
    /* malformed escapes — fall back to the raw string */
  }
  return isAbsolute(p) ? p : resolve(baseDir, p);
}

/**
 * Replace fenced code blocks and inline code spans with sentinel tokens so the
 * image scan never touches them, returning a `restore` to swap them back in.
 */
function maskCode(input: string): {
  masked: string;
  restore: (s: string) => string;
} {
  const stash: string[] = [];
  const keep = (m: string) => {
    const token = ` CODE${stash.length} `;
    stash.push(m);
    return token;
  };
  const masked = input
    .replace(/```[\s\S]*?```/g, keep)
    .replace(/~~~[\s\S]*?~~~/g, keep)
    .replace(/``[^`]*``/g, keep)
    .replace(/`[^`\n]*`/g, keep);
  const restore = (s: string) =>
    s.replace(/ CODE(\d+) /g, (_t, i) => stash[Number(i)]);
  return { masked, restore };
}
