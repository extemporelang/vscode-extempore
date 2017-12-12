# vscode-extempore

An [Extempore](https://extemporelang.github.io) language extension for Visual
Studio Code.

## Installation

Install it through the Extensions view (`View > Extensions`).

## Use

1. open up an Extempore file (with an `.xtm`) file extension.
2. start Extempore on your machine (the built-in Terminal is a nice way to do it)
3. connect VSCode to the Extempore process with `Extempore Connect` (use the Command Palette)
4. move your cursor into a top-level expression and evaluate it with `Extempore
   Eval` (default keybinding: `ctrl+enter` on Win/Linux, `cmd+enter` on macOS)

## Features

* Syntax highlighting
* Auto-indent on return
* Snippets: two example snippets are provided (tr: temporal recursion bf: bind-func)

## TODO

- allow for multiple simultaneous connections (on different host/port)
- more snippets
- make `Extempore Eval` send the current top-level `define`/`bind-func` for evaluation, rather than the directly enclosing one
- play nice with paredit/parinfer/other fancy editing tools
- automatically start/stop/manage the extempore process in the terminal

## Developer Notes

To work on this VSCode extension (any help is appreciated!) you need to:

1. install the deps with `npm install`
2. [activate](https://code.visualstudio.com/docs/extensions/example-hello-world#_extension-activation) the extension
3. make it better
4. submit a pull request

## Licence

MIT
