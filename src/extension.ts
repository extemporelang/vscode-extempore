'use strict';

import {ProviderResult, TextEdit, CancellationToken, FormattingOptions, TextEditor, TextDocument, Position, Range } from 'vscode';
import * as vscode from 'vscode';
import * as net from 'net';

import { xtmIndent, xtmInSexpr, xtmSexprToString } from './sexpr';

let socket = null;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "extempore" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    
    let helloDisposable = vscode.commands.registerCommand('extension.sayHello', () => {
        vscode.window.showInformationMessage('Hello World!');
    });
    context.subscriptions.push(helloDisposable);
    
    // send sexpr
    let sendSexprDisposable = vscode.commands.registerCommand('extension.xtmsend', () => {
        // The code you place here will be executed every time your command is executed
        let document = vscode.window.activeTextEditor.document;
        let txtstr = document.getText();
        let pos = vscode.window.activeTextEditor.selection.active;
        let sexpr = xtmInSexpr(txtstr, document.offsetAt(pos) - 1);
        let sexprstr = xtmSexprToString(txtstr, sexpr);
        //console.log("SEXPR AT: " + JSON.stringify(sexpr) + "\n'" + sexprstr + "'");
        let sexp2 = sexprstr.concat("\r\n");
        socket.write(sexp2);
    });
    context.subscriptions.push(sendSexprDisposable);

    // connect to extempore
    let connectDisposable = vscode.commands.registerCommand('extension.xtmconnect', () => {
        socket = new net.Socket();
        socket.connect(7099, '127.0.0.1', () => {
            vscode.window.showInformationMessage('Connected to Extempore!');
            //console.log("Connected to Extempore!");
        });
        socket.on('data', (data) => {
            console.log("data-in: " + JSON.stringify(data));
            // not doing anyting with received data yet
        });
        socket.on('close', () => {
            vscode.window.showInformationMessage('Connection closed!');            
        });
        socket.on('error', function (err) {
            vscode.window.showInformationMessage("Error: "+err.message);
            //console.log("Error: "+err.message);
        })
        socket.setEncoding('ascii');        
        socket.setKeepAlive(true);
        // The code you place here will be executed every time your command is executed
    });
    context.subscriptions.push(connectDisposable);

    // connect to extempore
    let disconnectDisposable = vscode.commands.registerCommand('extension.xtmdisconnect', () => {
        socket.destroy();
        // The code you place here will be executed every time your command is executed
    });
    context.subscriptions.push(disconnectDisposable);
    
    	/**
	 * The document formatting provider interface defines the contract between extensions and
	 * the formatting-feature.
	 */
    let indentDisposable = vscode.languages.registerOnTypeFormattingEditProvider('extempore', {
        provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
            let previousLines = new Position(0, 0);
            let backRange = new vscode.Range(previousLines, position);
            let txtstr = document.getText(backRange);
            let indent = xtmIndent(txtstr); 

            vscode.window.activeTextEditor.edit((edit)=> {
                let pos = vscode.window.activeTextEditor.selection.active;                    
                let startOfLine = new Position(pos.line, 0);
                let sol = new Range(startOfLine, pos);
                edit.delete(sol);                                        
                let emptyStr = ' '.repeat(indent);
                edit.insert(startOfLine,emptyStr);
            });
            return null;
        }
    }, '\n');
    context.subscriptions.push(indentDisposable);

    // vscode.languages.registerDocumentFormattingEditProvider('extempore', {
    //     provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    //         console.log("Hello World");
    //         /*
    //         const firstLine = document.lineAt(0);
    //         if (firstLine.text !== ';; Extempore rules!') {
    //             return [vscode.TextEdit.insert(firstLine.range.start, ';; Extempore rules!\n')];
    //         }
    //         */
    //         return null;
    //     }
    // });
    
}

// this method is called when your extension is deactivated
export function deactivate() {
}