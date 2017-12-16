# vscode-extempore

An [Extempore](https://extemporelang.github.io) language extension for Visual
Studio Code.

## Installation

Install it through the Extensions view (`View > Extensions`).

## Use

1. open up an Extempore file (with an `.xtm`) file extension.
2. start Extempore with `Extempore Start` (use the Command Palette)
3. connect VSCode to the Extempore process with `Extempore Connect`
4. move your cursor into a top-level expression and evaluate it with `Extempore
   Eval` (default keybinding: <kbd>ctrl</kbd>+<kbd>enter</kbd> on Win/Linux, <kbd>cmd</kbd>+<kbd>enter</kbd> on macOS)

## Features

* start & manage Extempore processes using the built-in terminal
* Syntax highlighting
* Auto-indent on return
* Snippets: two example snippets are provided (tr: temporal recursion bf: bind-func)

## TODO

- allow for multiple simultaneous connections (on different host/port)
- more snippets
- make `Extempore Eval` send the current top-level `define`/`bind-func` for evaluation, rather than the directly enclosing one
- play nice with paredit/parinfer/other fancy editing tools

## Changelog

- `0.0.1`: initial release

- `0.0.2`: prompt for host/port

- `0.0.3`: add `Extempore Start`, send selected region (if selection is active)

## Developer Notes

To work on this VSCode extension (any help is appreciated!) you need to:

1. install the deps with `npm install`
2. [activate](https://code.visualstudio.com/docs/extensions/example-hello-world#_extension-activation) the extension
3. make it better
4. submit a pull request

## Licence

MIT
