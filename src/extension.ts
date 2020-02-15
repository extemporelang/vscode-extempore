'use strict';

// vscode
import * as vscode from 'vscode';

// node
import { env } from 'process';
import { platform } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { setTimeout } from 'timers';
import { Socket } from 'net';
import { spawnSync } from 'child_process';
import * as download from 'download';

// Extempore extension
import { xtmIndent, xtmTopLevelSexpr, xtmGetBlock } from './sexpr';

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmdownloadbinary', () => downloadExtemporeBinary()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmstart', () => startExtemporeInTerminal()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmconnect', () => connectCommand()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmconnecthostport', () => connectToHostPortCommand()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.xtmeval', () => {
            let document = vscode.window.activeTextEditor.document;
            let editor = vscode.window.activeTextEditor;
            let evalRange: vscode.Range;

            if (!editor.selection.isEmpty) {
                // if there's a selection active, use that
                evalRange = editor.selection;
            } else {
                let offset = document.offsetAt(editor.selection.active);
                let charsAround = document.getText(
                    new vscode.Range(document.positionAt(offset - 1),
                        document.positionAt(offset + 1)));

                // hack for handling the special case where the cursor is just outside a
                // final closing bracket (so we do evaluate that form)
                if (charsAround[0] == ")" && charsAround[1] != ")") {
                    offset -= 1;
                }

                // figure out exactly what expression to send to Extempore
                let xtmBlock: [number, number, string] = xtmGetBlock(document.getText(), offset);
                //console.log(`xtmblk: '${xtmBlock[2]}'`);
                let xtmExpr = xtmTopLevelSexpr(xtmBlock[2], offset - xtmBlock[0]);
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
            () => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://extemporelang.github.io/'))));

    if (shouldUseFormatter()) {
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

        let indentDisposable2 = vscode.languages.registerDocumentRangeFormattingEditProvider('extempore', {
            provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
                let line = range.start.line;
                let line_end = range.end.line;
                let lines1000 = new vscode.Position((line - 1000 < 0) ? 0 : line - 1000, 0);
                let prevLines = new vscode.Range(lines1000, range.start);
                let s1 = document.getText(prevLines);
                let indent = xtmIndent(s1);
                let newstr = "";

                for (; line <= line_end; line++) {
                    let pos = new vscode.Position(line, 0);
                    let pos2 = new vscode.Position(line + 1, 0);
                    let linerng = new vscode.Range(pos, pos2);
                    let linestr = document.getText(linerng).trim();
                    newstr += ' '.repeat(indent) + linestr;
                    if (line < line_end) {
                        newstr += '\n';
                    }
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

export function dispose() {
    _socket.destroy();
    _terminal.dispose();
}

let _socket: Socket;
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
    if (platform() === "win32") {
        return false;
    } else {
        return spawnSync("which", ["extempore"]).status === 0;
    }
}

let getExtemporePath = (): string => {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("extempore");
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
        vscode.window.showErrorMessage("Extempore: can't find extempore folder. Set extempore.sharedir in the VSCode settings.");
        return;
    }

    _terminal = vscode.window.createTerminal("Extempore");
    _terminal.show(true); // show, but don't steal focus
    _terminal.sendText(`cd ${sharedir}`);
    _terminal.sendText(isExtemporeOnSystemPath() ? "extempore" : "./extempore");
};

let connectExtempore = (hostname: string, port: number) => {
    // create Extempore socket
    _socket = new Socket();
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
}

// connect to extempore with defaults
let connectCommand = () => {
    const config = vscode.workspace.getConfiguration("extempore");
    connectExtempore(config.get("hostname"), config.get("port"));
};

// connect to extempore
let connectToHostPortCommand = async () => {
    let hostname: string = await vscode.window.showInputBox({ prompt: 'Hostname', value: 'localhost' });
    let portString: string = await vscode.window.showInputBox({ prompt: 'Port number', value: '7099' });
    let port: number = parseInt(portString);
    connectExtempore(hostname, port);
};

// download & setup Extempore

let downloadExtemporeBinary = async () => {

    const extemporeVersion: string = '0.8.3'
    const releaseFileMap = {
        'win32': `Extempore-${extemporeVersion}-windows`,
        // we should probably use .zip on macOS as well (rather than .dmg)
        'darwin': `Extempore-${extemporeVersion}-macOS`
    }

    if (!(platform() in releaseFileMap)) {
        vscode.window.showErrorMessage('Extempore: binary download currently only available for macOS & Windows');
    }
    const releaseFile = releaseFileMap[platform()];
    const ghReleaseUri: string = `https://github.com/digego/extempore/releases/download/${extemporeVersion}/${releaseFile}.zip`;

    // where should we put it?
    const sharedir: string = await vscode.window.showOpenDialog(
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Choose Download Location'
        }).then(fileUris => fileUris[0].fsPath);

    const downloadPath = path.join(sharedir, releaseFile)
    if (fs.existsSync(downloadPath)) {
        vscode.window.showErrorMessage(`Extempore: sorry, ${downloadPath} already exists.`);
    }

    const downloadOptions = { extract: true, timeout: 10 * 1000 };

    // now, actually download the thing
    try {
        download(ghReleaseUri, `${sharedir}`, downloadOptions)
            .on('downloadProgress', (progress) => console.log(`${progress.percent * 100}% done`))
            .then(() => {
                const config = vscode.workspace.getConfiguration("extempore");
                config.update("sharedir", sharedir, true);
                vscode.window.showInformationMessage(`Extempore: successfully downloaded to ${sharedir}/${downloadPath}\n`
													 + 'also updating extempore.sharedir config setting');
            });

    } catch (error) {
        vscode.window.showErrorMessage(`Extempore: error downloading binary "${error.response.body}"`);
    };
}
