'use strict';

import * as vscode from 'vscode';
import * as net from 'net';

import { xtmIndent, xtmInSexpr, xtmSexprToString } from './sexpr';

let socket: net.Socket;
let terminal: vscode.Terminal;

function crlf2lf(strin: string): string {
    //console.log("CRLF_IN:\n", strin);
    let strout = strin.replace(/(\r\n|\n|\r)/gm, "\x0A");
    //console.log("LF_OUT:\n", strout);
    return strout;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('Extempore extension activated.');

    // eval sexpr
    let evalSexprDisposable = vscode.commands.registerCommand('extension.xtmeval', ()  => {
        let editor = vscode.window.activeTextEditor;
        let document = editor.document;
        let evalString = "";

        if (!editor.selection.isEmpty) {
            // if no code is selected, select current top-level form
            evalString = document.getText(editor.selection);
        } else  {
            let txtstr = document.getText();
            // make sure we are LF ends for Extempore comms
            let pos = vscode.window.activeTextEditor.selection.active;
            let sexpr = xtmInSexpr(txtstr, document.offsetAt(pos) - 1);
            evalString = xtmSexprToString(txtstr, sexpr);
        }
        socket.write(crlf2lf(evalString).concat("\r\n"));
    });
    context.subscriptions.push(evalSexprDisposable);

    // start Extempore in a new Terminal
    // TODO currently this assumes extempore is on $PATH, so it won't work on Windows
    let startExtemporeDisposable = vscode.commands.registerCommand('extension.xtmstart', () => {
        // if there's already an Extempore terminal running, kill it
        if (terminal) {
            terminal.dispose();
        }
        terminal = vscode.window.createTerminal("Extempore");
        terminal.show(true); // show, but don't steal focus
        terminal.sendText("extempore");
    });
    context.subscriptions.push(startExtemporeDisposable);

    // connect to extempore
    let connectDisposable = vscode.commands.registerCommand('extension.xtmconnect', async () => {
        let hostname: string = await vscode.window.showInputBox({ prompt: 'Hostname', value: 'localhost' });
        let portString: string = await vscode.window.showInputBox({ prompt: 'Port number', value: '7099' });
        let port: number = parseInt(portString);

        // create Extempore socket
        socket = new net.Socket();
        socket.setEncoding('ascii');
        socket.setKeepAlive(true);

        // set socket callbacks
        socket.connect(port, hostname, () => {
            vscode.window.setStatusBarMessage(`Extempore: connected to port ${port}`);
        });
        socket.on('data', (data) => {
            vscode.window.setStatusBarMessage(data.toString());
        });
        socket.on('close', () => {
            vscode.window.setStatusBarMessage(`Extempore: connection to port ${port} closed`);
        });
        socket.on('error', (err) => {
            vscode.window.showErrorMessage(`Extempore: socket connection error "${err.message}"`);
        })
    });
    context.subscriptions.push(connectDisposable);

    // connect to extempore
    let disconnectDisposable = vscode.commands.registerCommand('extension.xtmdisconnect', () => {
        socket.destroy();
    });
    context.subscriptions.push(disconnectDisposable);

    // indentation
    let indentDisposable = vscode.languages.registerOnTypeFormattingEditProvider('extempore', {
        provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, ch: string, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
            let previousLines = new vscode.Position(0, 0);
            let backRange = new vscode.Range(previousLines, position);
            let txtstr = document.getText(backRange);
            let indent = xtmIndent(txtstr);

            vscode.window.activeTextEditor.edit((edit)=> {
                let pos = vscode.window.activeTextEditor.selection.active;
                let startOfLine = new vscode.Position(pos.line, 0);
                let sol = new vscode.Range(startOfLine, pos);
                edit.delete(sol);
                let emptyStr = ' '.repeat(indent);
                edit.insert(startOfLine,emptyStr);
            });
            return null;
        }
    }, '\n');
    context.subscriptions.push(indentDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
    socket.destroy();
}
