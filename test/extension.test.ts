import * as assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

import type { Api } from "../src/extension";
import type { EvalResult } from "../src/server";

const extempore = process.env["EXTEMPORE"];
const fixtures = path.resolve(__dirname, "../../test/fixtures");

async function open(name: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(path.join(fixtures, name));
  await vscode.window.showTextDocument(document);
  return document;
}

// the language server has started once it answers a request
async function untilServing(document: vscode.TextDocument): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const symbols = await vscode.commands.executeCommand<unknown[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri,
    );
    if (symbols?.length) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the language server never answered");
}

suite("extension", function () {
  suiteSetup(async function () {
    if (!extempore) {
      this.skip();
    }
    await vscode.workspace
      .getConfiguration("extempore")
      .update("executable", extempore, vscode.ConfigurationTarget.Global);
  });

  test("the language server formats a document", async () => {
    const document = await open("format.xtm");
    await untilServing(document);
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      "vscode.executeFormatDocumentProvider",
      document.uri,
      { tabSize: 2, insertSpaces: true },
    );
    const edit = new vscode.WorkspaceEdit();
    edit.set(document.uri, edits);
    await vscode.workspace.applyEdit(edit);
    assert.equal(document.getText(), "(define f\n  (lambda (x)\n    (* x 2)))\n");
    await vscode.commands.executeCommand("workbench.action.files.revert");
  });
});

// An extempore in the fixtures folder, so its .nrepl-port is where the
// language server looks for it.
function startExtempore(): Promise<ChildProcess> {
  const child = spawn(
    extempore!,
    ["--no-audio", "--color", "never", "--no-legacy-server", "--nrepl-port", "0"],
    { cwd: fixtures, stdio: ["ignore", "pipe", "pipe"] },
  );
  return new Promise((resolve, reject) => {
    let console = "";
    const timer = setTimeout(
      () => reject(new Error(`extempore never started:\n${console}`)),
      60000,
    );
    const read = (chunk: Buffer) => {
      console += chunk.toString();
      if (console.includes("nREPL server started")) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("exit", () => reject(new Error(`extempore exited:\n${console}`)));
  });
}

suite("evaluation", function () {
  let xtm: ChildProcess | undefined;
  let api: Api;

  suiteSetup(async function () {
    if (!extempore) {
      this.skip();
    }
    xtm = await startExtempore();
    const extension = vscode.extensions.getExtension<Api>("extemporelang.vscode-extempore")!;
    api = await extension.activate();
  });

  suiteTeardown(() => {
    xtm?.kill();
  });

  async function evalAt(line: number, character: number): Promise<EvalResult> {
    const document = await open("eval.xtm");
    await untilServing(document);
    const editor = vscode.window.activeTextEditor!;
    editor.selection = new vscode.Selection(line, character, line, character);
    const evaluated = new Promise<EvalResult>((resolve) => {
      const listening = api.onDidEvaluate((result) => {
        listening.dispose();
        resolve(result);
      });
    });
    await vscode.commands.executeCommand("extempore.evaluate");
    return evaluated;
  }

  test("the form at the cursor", async () => {
    await evalAt(0, 3);
    const result = await evalAt(3, 2);
    assert.deepEqual(result.values, ["42"]);
    assert.deepEqual(result.range, {
      start: { line: 2, character: 0 },
      end: { line: 3, character: 5 },
    });
  });

  test("an error", async () => {
    const result = await evalAt(5, 1);
    assert.match(result.error?.message ?? "", /car argument, 5, is an integer/);
  });

  test("interrupting a runaway loop", async () => {
    await evalAt(0, 3); // the language server is up
    await open("loop.xtm");
    vscode.window.activeTextEditor!.selection = new vscode.Selection(0, 1, 0, 1);
    const evaluated = new Promise<EvalResult>((resolve) => {
      const listening = api.onDidEvaluate((result) => {
        listening.dispose();
        resolve(result);
      });
    });
    // neither command finishes before the loop stops, so neither is awaited
    void vscode.commands.executeCommand("extempore.evaluate");
    await new Promise((resolve) => setTimeout(resolve, 500));
    void vscode.commands.executeCommand("extempore.interruptEvaluation");
    assert.equal((await evaluated).interrupted, true);
    assert.deepEqual((await evalAt(0, 3)).values, ["40"]);
  });

  test("an error's diagnostic stays until its form is edited", async () => {
    await evalAt(5, 1);
    const document = vscode.window.activeTextEditor!.document;
    const lines = async (want: number[]) => {
      for (let i = 0; i < 50; i++) {
        const got = vscode.languages.getDiagnostics(document.uri).map((d) => d.range.start.line);
        if (JSON.stringify(got) === JSON.stringify(want)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.fail(`diagnostics never on lines ${JSON.stringify(want)}`);
    };
    const replace = async (line: number, from: number, to: number, text: string) => {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, new vscode.Range(line, from, line, to), text);
      await vscode.workspace.applyEdit(edit);
    };
    try {
      await lines([5]);
      await replace(0, 15, 17, "41"); // another form
      await lines([5]);
      await replace(5, 5, 6, "'(5)"); // the form which failed
      await lines([]);
    } finally {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
  });
});
