'use strict';

import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { setTimeout } from 'timers';

import { xtmIndent, xtmInSexpr, xtmTopLevelSexpr, xtmSexprToString } from './sexpr';

export function activate(context: vscode.ExtensionContext) {
    let extempore = new Extempore();

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmstart',
        () => extempore.startCommand()));
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmconnect',
        () => extempore.connectCommand()));
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmeval',
        () => extempore.evalCommand()));
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmdisconnect',
        () => extempore.disconnectCommand()));

    context.subscriptions.push(extempore);
}

class Extempore {

    private _socket: net.Socket;
    private _terminal: vscode.Terminal;

    constructor() {
        // nothing to do here - start with "Extempore Start" command
    }

    // utility functions
    crlf2lf(str: string): string {
        return str.replace(/(\r\n|\n|\r)/gm, "\x0A");
    }

    eval(str: string) {
        try {
            this._socket.write(this.crlf2lf(str).concat("\r\n"));
        } catch (error) {
            vscode.window.showErrorMessage("Extempore: error sending code to process---do you need to connect?")
        }
    }

    isExtemporeOnSystemPath(): boolean {
        if (os.platform() === "win32") {
            return false;
        } else {
            return spawnSync("which", ["extempore"]).status === 0;
        }
    }

    getExtemporePath() {
        let config = vscode.workspace.getConfiguration("extempore");
        if (config.has("sharedir")) {
            return config.get("sharedir");
        } else if (vscode.workspace.rootPath) {
            return vscode.workspace.rootPath;
        } else {
            return undefined;
        }
    }

    evalBlink(range: vscode.Range) {
        let decoration = vscode.window.createTextEditorDecorationType({
            color: "#000",
            backgroundColor: "#fd971f"
        });
        vscode.window.activeTextEditor.setDecorations(decoration, [range]);
        setTimeout(() => decoration.dispose(), 500);
    }

    // eval sexpr
    evalCommand() {
        let editor = vscode.window.activeTextEditor;
        let document = editor.document;
        let codeString = "";

        if (!editor.selection.isEmpty) {
            codeString = document.getText(editor.selection);
            // "flash" the eval'ed code
            this.evalBlink(editor.selection);
        } else {
            // if no code is selected, select current top-level form
            let txtstr = document.getText();
            // make sure we are LF ends for Extempore comms
            let pos = vscode.window.activeTextEditor.selection.active;
            let sexpr = xtmTopLevelSexpr(txtstr, document.offsetAt(pos) - 1);
            codeString = xtmSexprToString(txtstr, sexpr);
            // "flash" the eval'ed code
            this.evalBlink(new vscode.Range(document.positionAt(sexpr.start),
                document.positionAt(sexpr.end + 1)));
        }
        this.eval(codeString);
    };

    // start Extempore in a new Terminal
    startCommand(){
        // if there's already an Extempore terminal running, kill it
        if (this._terminal) {
            this._terminal.dispose();
        }
        // find the path to the extempore folder
        let sharedir = this.getExtemporePath();

        if (!sharedir) {
            vscode.window.showErrorMessage("Extempore: can't find extempore folder.");
            return;
        }

        this._terminal = vscode.window.createTerminal("Extempore");
        this._terminal.show(true); // show, but don't steal focus

        if (os.platform() === 'win32') {
            this._terminal.sendText(`cwd ${sharedir}`);
            this._terminal.sendText(`./extempore.exe`);
        } else {
            this._terminal.sendText(`cd ${sharedir}`);
            this._terminal.sendText(this.isExtemporeOnSystemPath() ? "extempore" : "./extempore");
        };
    };

    // connect to extempore
    async connectCommand(){
        let hostname: string = await vscode.window.showInputBox({ prompt: 'Hostname', value: 'localhost' });
        let portString: string = await vscode.window.showInputBox({ prompt: 'Port number', value: '7099' });
        let port: number = parseInt(portString);

        // create Extempore socket
        this._socket = new net.Socket();
        this._socket.setEncoding('ascii');
        this._socket.setKeepAlive(true);

        // set socket callbacks
        this._socket.connect(port, hostname, () => {
            vscode.window.setStatusBarMessage(`Extempore: connected to port ${port}`);
        });
        this._socket.on('data', (data) => {
            vscode.window.setStatusBarMessage(data.toString());
        });
        this._socket.on('close', () => {
            vscode.window.setStatusBarMessage(`Extempore: connection to port ${port} closed`);
        });
        this._socket.on('error', (err) => {
            vscode.window.showErrorMessage(`Extempore: socket connection error "${err.message}"`);
        })
    };

    disconnectCommand() {
        this._socket.destroy();
    }

    registerFormattingProvider(context: vscode.ExtensionContext) {
        let indentDisposable = vscode.languages.registerOnTypeFormattingEditProvider('extempore', {
            provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, ch: string, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
                let previousLines = new vscode.Position(0, 0);
                let backRange = new vscode.Range(previousLines, position);
                let txtstr = document.getText(backRange);
                let indent = xtmIndent(txtstr);

                vscode.window.activeTextEditor.edit((edit) => {
                    let pos = vscode.window.activeTextEditor.selection.active;
                    let startOfLine = new vscode.Position(pos.line, 0);
                    let sol = new vscode.Range(startOfLine, pos);
                    edit.delete(sol);
                    let emptyStr = ' '.repeat(indent);
                    edit.insert(startOfLine, emptyStr);
                });
                return null;
            }
        }, '\n');
        context.subscriptions.push(indentDisposable);
    }

    dispose() {
        this._socket.destroy();
        this._terminal.dispose();
    }
}
