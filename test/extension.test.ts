import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";

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
