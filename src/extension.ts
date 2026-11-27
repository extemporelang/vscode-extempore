import * as path from "node:path";
import * as vscode from "vscode";

import { installedBinDir, installedExecutable, installExtempore, shareDirOf } from "./install";
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

// The extempore to run: the setting, then the one Extempore: Install Extempore
// (or an install script) installed, then whichever is on PATH.
function executable(): string {
  return config().get<string>("executable") || installedExecutable() || "extempore";
}

async function setUp(): Promise<void> {
  const useLegacy = config().get<string>("transport") === "legacy";
  legacy = useLegacy ? new LegacyTransport(results.output) : undefined;
  server = new Server(executable(), results);
  await server.start(useLegacy);
}

async function tearDown(): Promise<void> {
  legacy?.dispose();
  legacy = undefined;
  await server?.stop();
  server = undefined;
  results.clearAll();
}

// Where Extempore: Start runs extempore: the sharedir setting, then
// $EXTEMPORE_PATH, then the first workspace folder.
function startDir(): string | undefined {
  return (
    config().get<string>("sharedir") ||
    process.env["EXTEMPORE_PATH"] ||
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  );
}

// The folder with libs/ and runtime/, which (sys:load "libs/...") paths are
// relative to: the sharedir setting, then $EXTEMPORE_PATH, then the share
// folder of the extempore being run, then the first workspace folder.
function sharedir(): string | undefined {
  return (
    config().get<string>("sharedir") ||
    process.env["EXTEMPORE_PATH"] ||
    shareDirOf(executable()) ||
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  );
}

function startInTerminal(): void {
  terminal?.dispose();
  terminal = vscode.window.createTerminal({
    name: "Extempore",
    cwd: startDir(),
    shellPath: executable(),
    shellArgs: [],
  });
  terminal.show(true);
}

// VS Code's terminals get the installed extempore on PATH.
function putInstalledOnPath(env: vscode.GlobalEnvironmentVariableCollection): void {
  env.clear();
  if (installedExecutable()) {
    env.description = "puts the extempore which Extempore: Install Extempore installed on PATH";
    env.prepend("PATH", installedBinDir() + path.delimiter);
  }
}

// After an install: use it, and offer to drop an extempore.executable setting
// which names some other extempore.
async function installed(exe: string | undefined, context: vscode.ExtensionContext): Promise<void> {
  if (!exe) {
    return;
  }
  putInstalledOnPath(context.environmentVariableCollection);
  const setting = config().inspect<string>("executable")?.globalValue;
  if (setting && setting !== exe) {
    const choice = await vscode.window.showInformationMessage(
      `Extempore is installed. Your extempore.executable setting names another one (${setting}): use the new one instead?`,
      "Use the new one",
      "Keep the setting",
    );
    if (choice === "Use the new one") {
      // the configuration listener restarts the language server
      await config().update("executable", undefined, vscode.ConfigurationTarget.Global);
      await config().update("sharedir", undefined, vscode.ConfigurationTarget.Global);
      return;
    }
  }
  await tearDown();
  await setUp();
  void vscode.window.showInformationMessage(
    "Extempore is installed: run Extempore: Start to start it. VS Code's terminals have the extempore command.",
  );
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
  const install = async () => installed(await installExtempore(), context);
  command("extempore.install", install);
  // the command's name before 0.4.0, for keybindings which name it
  command("extempore.downloadBinary", install);
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
  putInstalledOnPath(context.environmentVariableCollection);
  await setUp();
  return { onDidEvaluate: results.onDidEvaluate };
}

export async function deactivate(): Promise<void> {
  terminal?.dispose();
  await tearDown();
}
