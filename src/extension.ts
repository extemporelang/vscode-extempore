'use strict';

import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { setTimeout } from 'timers';
import { env } from 'process';
import opn = require('opn');

import { xtmIndent } from './sexpr';
import { matchBracket } from './match-bracket';

export function activate (context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmstart', () => startExtemporeInTerminal()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmconnect', () => connectCommand()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmeval', () => {
            let evalRange = getRangeForEval();
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

// let openingBracketPos = (pos: vscode.Position): vscode.Position => {
//     let document = vscode.window.activeTextEditor.document;
//     let text = document.getText();
//     let cursorPos = document.offsetAt(pos);
//     let bracketOffset = text.lastIndexOf("(", cursorPos);
//     if (bracketOffset === -1) {
//         return null; // we're not inside any bracket pair
//     } else {
//         return document.positionAt(bracketOffset);
//     }
// }

//
// this is a temporary solution - it is certainly not foolproof.
// placeholder until (me, you, someone), has time to fix it properly. 
// 
let openingBracketPos = (pos: vscode.Position): vscode.Position => {
    let document = vscode.window.activeTextEditor.document;
    let cnt = 0;
    while (true && cnt < 10) {
        cnt++;
        let res = openingBracketPosHelper(pos);
        // console.log(`result ${res} for cnt ${cnt}`);
        if (res === null) return null;
        if (res < 0) {
            pos = document.positionAt(res * -1);
            continue;
        }
        return document.positionAt(res);
    }
    return null;
}   

let openingBracketPosHelper = (pos: vscode.Position): number => {
    let document = vscode.window.activeTextEditor.document;
    let text = document.getText();
    let cursorPos = document.offsetAt(pos);
    // find open (
    let bracketOffset = text.lastIndexOf("(", cursorPos);
    if (bracketOffset === -1) return null; // not inside any bracket pair

    // this is a temporary (i.e. not foolproof) fix for when an openingBrace falls inside a string
    // although the next few lines seem redundant this is probably faster than using regexps
    let quoteOffsetBack = text.lastIndexOf("\"", bracketOffset);
    let quoteOffsetForward = text.indexOf("\"", bracketOffset);
    if (quoteOffsetForward < 0) quoteOffsetForward = Number.MAX_VALUE; // failing to find forward quote should result in large positive result
    let openBracketOffsetBack = text.lastIndexOf("(", bracketOffset-1);
    let openBracketOffsetForward = text.indexOf("(", bracketOffset+1);
    let closingBracketOffsetBack = text.lastIndexOf(")", bracketOffset);
    let closingBracketOffsetForward = text.indexOf(")", bracketOffset);
    // does another bracket (going backards) arrive before a string quote?
    let back = (quoteOffsetBack <= openBracketOffsetBack) && (quoteOffsetBack <= closingBracketOffsetBack);
    // does another bracket (going forwards) arrive before a string quote?
    let forward = (quoteOffsetForward >= openBracketOffsetForward) && (quoteOffsetForward >= closingBracketOffsetForward);
    /*
    console.log(`\nbracketOffset = ${bracketOffset}`);
    console.log(`quoteOffsetBack = ${quoteOffsetBack}`);
    console.log(`quoteOffsetForward = ${quoteOffsetForward}`);
    console.log(`openBracketOffsetBack = ${openBracketOffsetBack}`);
    console.log(`openBracketOffsetForward = ${openBracketOffsetForward}`);
    console.log(`closingBracketOffsetBack = ${closingBracketOffsetBack}`);
    console.log(`closingBracketOffsetForward = ${closingBracketOffsetForward}`);
    */
    if (!back && !forward) {
        return -1 * openBracketOffsetBack;
    } else {
        return bracketOffset;
    }
}


let matchBracketRange = (text, pos: vscode.Position): vscode.Range => {
    let matchPos = matchBracket(text, pos, 'xtm');
    if (matchPos) {
        return new vscode.Range(pos, matchPos);
    } else {
        return null;
    }
}

let getRangeForEval = (): vscode.Range => {
    let editor = vscode.window.activeTextEditor;
    let document = editor.document;

    if (!editor.selection.isEmpty) {
        // if there's a selection active, use that
        return editor.selection;
    } else {
        // otherwise find the enclosing top-level s-expression
        let text = document.getText();
        let sexpRange = new vscode.Range(editor.selection.active, editor.selection.active);
        let bracketPos = openingBracketPos(document.positionAt(document.offsetAt(sexpRange.start)+1));
        while (bracketPos) {
            let match = matchBracketRange(text, bracketPos);
            if (match && match.contains(sexpRange)) {
                sexpRange = match;
            }
            // select next open paren (growing "outward")
            bracketPos = openingBracketPos(document.positionAt(document.offsetAt(bracketPos)-1));
        }
        if (!sexpRange.isEmpty) {
            // grow the "end" by 1 to include the final close paren
            return new vscode.Range(sexpRange.start, document.positionAt(document.offsetAt(sexpRange.end)+1));
        } else {
            return null;
        }
    }
};

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
