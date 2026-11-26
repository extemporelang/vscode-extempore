// extempore's language server (`extempore lsp`): formatting, outline and
// folding on its own, and with a running extempore's nREPL server, completion,
// hover and evaluation (the nREPL transport).

import * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type Range as LspRange,
} from "vscode-languageclient/node";

import { topLevelFormAt } from "./forms";
import { blink, type Results } from "./results";

// What the server answers an eval with, given evalResults: "response".
export interface EvalResult {
  values: string[];
  out: string;
  error?: { kind?: string; message: string; line?: number };
  interrupted?: boolean;
  range?: LspRange;
}

export class Server {
  private readonly client: LanguageClient;

  constructor(
    executable: string,
    private readonly results: Results,
  ) {
    const config = vscode.workspace.getConfiguration("extempore.nrepl");
    const port = config.get<number | null>("port");
    const process = config.get<string>("process");
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ language: "extempore" }],
      initializationOptions: {
        host: config.get<string>("host"),
        ...(port ? { port } : {}),
        ...(process ? { process } : {}),
        evalResults: "response",
      },
      // The client registers the server's commands (extempore.eval and so on)
      // as VS Code commands, which its code actions run; every eval, from
      // them or from extempore.evaluate, comes back through here.
      middleware: {
        executeCommand: async (command, args, next) => {
          const answer: unknown = await next(command, args);
          this.present(args[0], answer);
          return answer;
        },
      },
    };
    this.client = new LanguageClient(
      "extempore",
      "Extempore Language Server",
      { command: executable, args: ["lsp"] },
      clientOptions,
    );
  }

  // Quiet, a server which won't start says nothing: the legacy transport
  // works without one, for an extempore too old to have `extempore lsp`.
  async start(quiet: boolean): Promise<void> {
    try {
      await this.client.start();
    } catch (error) {
      if (quiet) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(
        `Extempore: couldn't start the language server (${message}). Is extempore.executable set to an extempore with \`extempore lsp\`?`,
      );
    }
  }

  async restart(): Promise<void> {
    await this.client.restart();
  }

  async eval(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    const selection = editor.selection;
    let range: vscode.Range = selection;
    if (selection.isEmpty) {
      const form = topLevelFormAt(document.getText(), document.offsetAt(selection.active));
      if (form) {
        range = new vscode.Range(document.positionAt(form.start), document.positionAt(form.end));
      }
    }
    blink(editor, range);
    // an empty range asks the server for the form at the cursor
    const at = selection.isEmpty ? new vscode.Range(selection.active, selection.active) : selection;
    await this.run("extempore.eval", {
      uri: document.uri.toString(),
      range: this.client.code2ProtocolConverter.asRange(at),
    });
  }

  async evalBuffer(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    blink(editor, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)));
    await this.run("extempore.evalBuffer", { uri: document.uri.toString() });
  }

  async interrupt(): Promise<void> {
    await this.run("extempore.interrupt");
  }

  private async run(command: string, ...args: unknown[]): Promise<void> {
    if (!this.client.isRunning()) {
      void vscode.window.showErrorMessage("Extempore: the language server isn't running (Extempore: Restart language server)");
      return;
    }
    await vscode.commands.executeCommand(command, ...args);
  }

  // Shows the answer to an eval at its form, or where the server gives no
  // range (or answers without evalResults, having said it with showMessage),
  // not at all.
  private present(argument: unknown, answer: unknown): void {
    const uri = (argument as { uri?: string } | undefined)?.uri;
    if (!uri || !isEvalResult(answer) || !answer.range) {
      return;
    }
    const document = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri);
    if (document) {
      this.results.show(document, this.client.protocol2CodeConverter.asRange(answer.range), answer);
    }
  }

  async stop(): Promise<void> {
    if (this.client.isRunning()) {
      await this.client.stop();
    }
  }
}

function isEvalResult(value: unknown): value is EvalResult {
  return typeof value === "object" && value !== null && Array.isArray((value as EvalResult).values);
}
