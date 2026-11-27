// The legacy transport: code sent over a raw socket to extempore's eval server
// (port 7099), which answers each form with its value as text, ended by a NUL.

import { Socket } from "node:net";
import * as vscode from "vscode";

import { topLevelForms, topLevelFormAt } from "./forms";
import { blink } from "./results";

// The complete replies in buffered, and what is left of an unfinished one.
export function splitReplies(buffered: string): { replies: string[]; rest: string } {
  const parts = buffered.split("\0");
  const rest = parts.pop() ?? "";
  return { replies: parts.map((reply) => reply.trim()).filter(Boolean), rest };
}

export class LegacyTransport implements vscode.Disposable {
  private socket: Socket | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  connect(hostname: string, port: number): void {
    this.socket?.destroy();
    const socket = new Socket();
    let buffered = "";
    socket.setEncoding("utf8");
    socket.setKeepAlive(true);
    socket.on("data", (data) => {
      const { replies, rest } = splitReplies(buffered + data.toString());
      buffered = rest;
      for (const reply of replies) {
        this.output.appendLine(reply);
      }
      const last = replies.at(-1);
      if (last) {
        vscode.window.setStatusBarMessage(`Extempore: ${last}`, 5000);
      }
    });
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
