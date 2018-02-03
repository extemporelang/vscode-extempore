'use strict';

import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { setTimeout } from 'timers';
import { env } from 'process';
import opn = require('opn');

import { xtmIndent, xtmTopLevelSexpr, xtmGetBlock } from './sexpr';

export function activate (context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmstart', () => startExtemporeInTerminal()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmconnect', () => connectCommand()));
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmeval', () => {
            let document = vscode.window.activeTextEditor.document;
            let editor = vscode.window.activeTextEditor;
            let evalRange: vscode.Range;

            if (!editor.selection.isEmpty) {
                // if there's a selection active, use that
                evalRange = editor.selection;
            } else {       
                let pos = document.offsetAt(editor.selection.active);
                let xtmBlock: [number, number, string] = xtmGetBlock(document.getText(), pos);
                //console.log(`xtmblk: '${xtmBlock[2]}'`);
                let xtmExpr = xtmTopLevelSexpr(xtmBlock[2], pos - xtmBlock[0]);
                //console.log(`xtmexp: ${JSON.stringify(xtmExpr)}`);
                let start = document.positionAt(xtmExpr[0] + xtmBlock[0]);
                let end = document.positionAt(xtmExpr[1] + 1 + xtmBlock[0]);
                evalRange = new vscode.Range(start, end);
            }    
            if (evalRange) {
                try {
                    sendToProcess(vscode.window.activeTextEditor.document.getText(evalRange));
                    blinkRange(evalRange);
                } catch (error) {
                    vscode.window.showErrorMessage("Extempore: error sending code to process---do you need to connect?")
                }
            }
        }));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmdisconnect',
            () => _socket.destroy()));
    
    // eventually the help command should do more than just jump to
    // the main Extempore page but this is better than nothing for now
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmhelp',
            () => opn('https://extemporelang.github.io/')));

    if (shouldUseFormatter()) {
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

        let indentDisposable2 = vscode.languages.registerDocumentRangeFormattingEditProvider('extempore', {
            provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
                let line = range.start.line;
                let line_end = range.end.line;
                let lines1000 = new vscode.Position((line - 1000 < 0) ? 0 : line - 1000, 0);
                let prevLines = new vscode.Range(lines1000, range.start);
                let s1 = document.getText(prevLines); 
                let indent = xtmIndent(s1);    
                let newstr = "";
                
                for (; line < line_end; line++) {
                    let pos = new vscode.Position(line, 0);
                    let pos2 = new vscode.Position(line+1, 0);
                    let linerng = new vscode.Range(pos, pos2);
                    let linestr = document.getText(linerng).trim();
                    newstr += ' '.repeat(indent) + linestr + '\n';
                    indent = xtmIndent(newstr);    
                }
                vscode.window.activeTextEditor.edit((edit) => {
                    edit.replace(range, newstr);
                });
                return null;
            }
        }); 
        context.subscriptions.push(indentDisposable2);
    }
}

export function dispose () {
    _socket.destroy();
    _terminal.dispose();
}

let _socket: net.Socket;
let _terminal: vscode.Terminal;

// unless paredit or parinfer are active, use the extempore formatter
let shouldUseFormatter = () => {
    for (const extensionId of ['clptn.code-paredit', 'shaunlebron.vscode-parinfer']) {
        let ext = vscode.extensions.getExtension(extensionId);
        if (ext && ext.isActive) {
            return false;
        }
    }
    return true;
}

let isExtemporeOnSystemPath = (): boolean => {
    if (os.platform() === "win32") {
        return false;
    } else {
        return spawnSync("which", ["extempore"]).status === 0;
    }
}

let getExtemporePath = (): string => {
    const config = vscode.workspace.getConfiguration("extempore");
    if (env["EXTEMPORE_PATH"]) {
        return env["EXTEMPORE_PATH"];
    } else if (config.has("sharedir")) {
        return config.get("sharedir");
    } else if (vscode.workspace.rootPath) {
        return vscode.workspace.rootPath;
    } else {
        return undefined;
    }
}

let blinkRange = (range: vscode.Range) => {
    let decoration = vscode.window.createTextEditorDecorationType({
        color: "#000",
        backgroundColor: "#fd971f"
    });
    vscode.window.activeTextEditor.setDecorations(decoration, [range]);
    setTimeout(() => decoration.dispose(), 500);
}

let sendToProcess = (str: string) => {
    // get the string ready for sending over the nextwork
    // make sure it's got the CRLF line ending Extempore expects
    _socket.write(str.replace(/(\r\n|\n|\r)/gm, "\x0A").concat("\r\n"));
}

// start Extempore in a new Terminal
let startExtemporeInTerminal = () => {
    // if there's already an Extempore terminal running, kill it
    if (_terminal) {
        _terminal.dispose();
    }
    // find the path to the extempore folder
    let sharedir = getExtemporePath();

    if (!sharedir) {
        vscode.window.showErrorMessage("Extempore: can't find extempore folder.");
        return;
    }

    _terminal = vscode.window.createTerminal("Extempore");
    _terminal.show(true); // show, but don't steal focus

    if (os.platform() === 'win32') {
        _terminal.sendText(`cwd ${sharedir}`);
        _terminal.sendText(`./extempore.exe`);
    } else {
        _terminal.sendText(`cd ${sharedir}`);
        _terminal.sendText(isExtemporeOnSystemPath() ? "extempore" : "./extempore");
    };
};

// connect to extempore
let connectCommand = async () => {
    let hostname: string = await vscode.window.showInputBox({ prompt: 'Hostname', value: 'localhost' });
    let portString: string = await vscode.window.showInputBox({ prompt: 'Port number', value: '7099' });
    let port: number = parseInt(portString);

    // create Extempore socket
    _socket = new net.Socket();
    _socket.setEncoding('ascii');
    _socket.setKeepAlive(true);

    // set socket callbacks
    _socket.connect(port, hostname, () => {
        vscode.window.setStatusBarMessage(`Extempore: connected to port ${port}`);
    });
    _socket.on('data', (data) => {
        vscode.window.setStatusBarMessage(data.toString());
    });
    _socket.on('close', () => {
        vscode.window.setStatusBarMessage(`Extempore: connection to port ${port} closed`);
    });
    _socket.on('error', (err) => {
        vscode.window.showErrorMessage(`Extempore: socket connection error "${err.message}"`);
    })
};
