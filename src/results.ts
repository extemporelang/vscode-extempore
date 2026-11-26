// Showing evaluations: a blink over the code sent, and each result inline at
// the end of its form, until the document is next edited.

import * as vscode from "vscode";

import type { EvalResult } from "./server";

const blinkDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
});

export function blink(editor: vscode.TextEditor, range: vscode.Range): void {
  editor.setDecorations(blinkDecoration, [range]);
  setTimeout(() => editor.setDecorations(blinkDecoration, []), 300);
}

// The one line shown after a form: its values, else its error or the first
// line of its output.
export function summary(result: EvalResult): string {
  if (result.interrupted) {
    return "interrupted";
  }
  if (result.error) {
    return result.error.message.split("\n")[0] ?? "";
  }
  if (result.values.length > 0) {
    return result.values.map((value) => `=> ${value}`).join("  ");
  }
  return result.out.trim().split("\n")[0] ?? "";
}

export class Results implements vscode.Disposable {
  readonly output = vscode.window.createOutputChannel("Extempore");
  private readonly evaluated = new vscode.EventEmitter<EvalResult>();
  // each evaluation's result, as it is shown
  readonly onDidEvaluate = this.evaluated.event;
  private readonly value = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1em", color: new vscode.ThemeColor("editorCodeLens.foreground") },
  });
  private readonly error = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1em", color: new vscode.ThemeColor("editorError.foreground") },
  });
  private readonly shown = new Map<
    string,
    { value: vscode.DecorationOptions[]; error: vscode.DecorationOptions[] }
  >();
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
          this.clear(event.document);
        }
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => this.redraw()),
    ];
  }

  // At the end of range, or without one (a file evaluated cleanly) in the
  // status bar.
  show(document: vscode.TextDocument, range: vscode.Range | undefined, result: EvalResult): void {
    this.evaluated.fire(result);
    if (result.out) {
      this.output.append(result.out.endsWith("\n") ? result.out : `${result.out}\n`);
    }
    if (result.error) {
      this.output.appendLine(result.error.message);
    }
    const text = summary(result);
    if (!range) {
      vscode.window.setStatusBarMessage(`Extempore: ${text || "evaluated"}`, 5000);
      return;
    }
    if (!text) {
      return;
    }
    const key = document.uri.toString();
    const shown = this.shown.get(key) ?? { value: [], error: [] };
    // a newer result for the same line replaces the older
    const line = range.end.line;
    shown.value = shown.value.filter((d) => d.range.start.line !== line);
    shown.error = shown.error.filter((d) => d.range.start.line !== line);
    const end = document.lineAt(line).range.end;
    const decoration: vscode.DecorationOptions = {
      range: new vscode.Range(end, end),
      renderOptions: { after: { contentText: text } },
      hoverMessage: new vscode.MarkdownString().appendCodeblock(
        result.error?.message ?? result.out + result.values.join("\n"),
      ),
    };
    (result.error || result.interrupted ? shown.error : shown.value).push(decoration);
    this.shown.set(key, shown);
    this.redraw();
  }

  private clear(document: vscode.TextDocument): void {
    if (this.shown.delete(document.uri.toString())) {
      this.redraw();
    }
  }

  private redraw(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const shown = this.shown.get(editor.document.uri.toString());
      editor.setDecorations(this.value, shown?.value ?? []);
      editor.setDecorations(this.error, shown?.error ?? []);
    }
  }

  dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.value.dispose();
    this.error.dispose();
    this.output.dispose();
    this.evaluated.dispose();
  }
}
