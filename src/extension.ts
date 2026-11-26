import * as path from "node:path";
import * as vscode from "vscode";

import { downloadExtempore } from "./download";
import { LegacyTransport } from "./legacy";
import { type EvalResult, Server } from "./server";
import { Results } from "./results";

// The language server always runs (formatting and the outline need no running
// extempore); evaluation goes through it, or with the legacy transport over a
// socket to the eval server.
let server: Server | undefined;
let legacy: LegacyTransport | undefined;
let results: Results;
let terminal: vscode.Terminal | undefined;

function config() {
  return vscode.workspace.getConfiguration("extempore");
}

async function setUp(): Promise<void> {
  const useLegacy = config().get<string>("transport") === "legacy";
  legacy = useLegacy ? new LegacyTransport() : undefined;
  server = new Server(config().get<string>("executable") || "extempore", results);
  await server.start(useLegacy);
}

async function tearDown(): Promise<void> {
  legacy?.dispose();
  legacy = undefined;
  await server?.stop();
  server = undefined;
}

// The extempore folder: the setting, then $EXTEMPORE_PATH, then the first
// workspace folder.
function sharedir(): string | undefined {
  return (
    config().get<string>("sharedir") ||
    process.env["EXTEMPORE_PATH"] ||
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  );
}

function startInTerminal(): void {
  terminal?.dispose();
  terminal = vscode.window.createTerminal({
    name: "Extempore",
    cwd: sharedir(),
    shellPath: config().get<string>("executable") || "extempore",
    shellArgs: [],
  });
  terminal.show(true);
}

function withEditor(run: (editor: vscode.TextEditor) => unknown): () => unknown {
  return () => {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId === "extempore") {
      return run(editor);
    }
    return undefined;
  };
}

async function connectHostPort(): Promise<void> {
  const hostname = await vscode.window.showInputBox({
    prompt: "Hostname",
    value: config().get("hostname"),
  });
  const port = await vscode.window.showInputBox({
    prompt: "Port",
    value: String(config().get("port")),
  });
  if (hostname && port) {
    legacy?.connect(hostname, Number.parseInt(port, 10));
  }
}

// `(sys:load "libs/core/instruments.xtm")` links to the file, relative to the
// extempore folder.
const loadLinks: vscode.DocumentLinkProvider = {
  provideDocumentLinks(document) {
    const links: vscode.DocumentLink[] = [];
    for (const match of document.getText().matchAll(/(?<=\(sys:load ")[^"]+\.[^"]+(?=")/g)) {
      const base = sharedir();
      const file = path.isAbsolute(match[0]) ? match[0] : base && path.join(base, match[0]);
      if (file) {
        const start = document.positionAt(match.index);
        links.push(
          new vscode.DocumentLink(
            new vscode.Range(start, start.translate(0, match[0].length)),
            vscode.Uri.file(file),
          ),
        );
      }
    }
    return links;
  },
};

const legacyOnly = () => {
  void vscode.window.showInformationMessage(
    "Extempore: that command is for the legacy transport (extempore.transport)",
  );
};

// The extension's API, for other extensions (and the tests).
export interface Api {
  onDidEvaluate: vscode.Event<EvalResult>;
}

export async function activate(context: vscode.ExtensionContext): Promise<Api> {
  results = new Results();
  const command = (name: string, run: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(name, run));

  command(
    "extempore.evaluate",
    withEditor((editor) => (legacy ? legacy.eval(editor) : server?.eval(editor))),
  );
  command(
    "extempore.evaluateFile",
    withEditor((editor) => (legacy ? legacy.evalBuffer(editor) : server?.evalBuffer(editor))),
  );
  command("extempore.interruptEvaluation", () => server?.interrupt());
  command("extempore.restartLanguageServer", () => server?.restart());
  command("extempore.start", startInTerminal);
  command("extempore.connect", () =>
    legacy
      ? legacy.connect(config().get("hostname") ?? "localhost", config().get("port") ?? 7099)
      : legacyOnly(),
  );
  command("extempore.connectHostPort", () => (legacy ? connectHostPort() : legacyOnly()));
  command("extempore.disconnect", () => (legacy ? legacy.disconnect() : legacyOnly()));
  command("extempore.downloadBinary", downloadExtempore);
  command("extempore.help", () =>
    vscode.env.openExternal(vscode.Uri.parse("https://extemporelang.github.io/")),
  );

  context.subscriptions.push(
    results,
    vscode.languages.registerDocumentLinkProvider("extempore", loadLinks),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        ["extempore.transport", "extempore.executable", "extempore.nrepl"].some((s) =>
          event.affectsConfiguration(s),
        )
      ) {
        await tearDown();
        await setUp();
      }
    }),
  );
  await setUp();
  return { onDidEvaluate: results.onDidEvaluate };
}

export async function deactivate(): Promise<void> {
  terminal?.dispose();
  await tearDown();
}
