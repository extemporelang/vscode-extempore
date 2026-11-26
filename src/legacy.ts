// The legacy transport: code sent over a raw socket to extempore's eval server
// (port 7099), which answers each form with its value as a line of text.

import { Socket } from "node:net";
import * as vscode from "vscode";

import { topLevelForms, topLevelFormAt } from "./forms";
import { blink } from "./results";

export class LegacyTransport implements vscode.Disposable {
  private socket: Socket | undefined;

  connect(hostname: string, port: number): void {
    this.socket?.destroy();
    const socket = new Socket();
    socket.setEncoding("utf8");
    socket.setKeepAlive(true);
    socket.on("data", (data) => vscode.window.setStatusBarMessage(data.toString().trim(), 5000));
    socket.on("close", () => {
      vscode.window.setStatusBarMessage(
        `Extempore: connection to ${hostname}:${port} closed`,
        5000,
      );
      if (this.socket === socket) {
        this.socket = undefined;
      }
    });
    socket.on("error", (error) => {
      void vscode.window.showErrorMessage(
        `Extempore: connection to ${hostname}:${port} failed (${error.message})`,
      );
    });
    socket.connect(port, hostname, () =>
      vscode.window.setStatusBarMessage(`Extempore: connected to ${hostname}:${port}`, 5000),
    );
    this.socket = socket;
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }

  eval(editor: vscode.TextEditor): void {
    const document = editor.document;
    let range: vscode.Range | undefined = editor.selection;
    if (editor.selection.isEmpty) {
      const form = topLevelFormAt(document.getText(), document.offsetAt(editor.selection.active));
      range =
        form && new vscode.Range(document.positionAt(form.start), document.positionAt(form.end));
    }
    if (range && this.send(document.getText(range))) {
      blink(editor, range);
    }
  }

  // a form at a time, as the eval server reads one per line
  evalBuffer(editor: vscode.TextEditor): void {
    const text = editor.document.getText();
    for (const form of topLevelForms(text)) {
      if (!this.send(text.slice(form.start, form.end))) {
        return;
      }
    }
  }

  private send(code: string): boolean {
    if (!this.socket || this.socket.destroyed) {
      void vscode.window.showErrorMessage("Extempore: not connected (Extempore: Connect (legacy))");
      return false;
    }
    this.socket.write(`${code.replace(/\r\n?/g, "\n")}\r\n`);
    return true;
  }

  dispose(): void {
    this.disconnect();
  }
}
