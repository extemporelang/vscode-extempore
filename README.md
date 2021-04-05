# vscode-extempore

An [Extempore](https://extemporelang.github.io) language extension for Visual
Studio Code.

## Installation

Install it through the Extensions view (`View > Extensions`); search for "vscode-extempore".

## Use

0. [set up Extempore on your computer](https://extemporelang.github.io/docs/overview/quickstart/)

1. open up an Extempore file (with an `.xtm`) file extension

2. start Extempore with `Extempore Start` (use the Command Palette)

3. connect VSCode to the Extempore process with `Extempore Connect`

4. move your cursor into an Extempore expression and evaluate it with `Extempore
   Eval` (default keybinding: <kbd>ctrl</kbd>+<kbd>enter</kbd> on Win/Linux,
   <kbd>cmd</kbd>+<kbd>enter</kbd> on macOS)

## Configuration

### Keybindings

Only `Extempore Eval` has a keybinding by default---although you should
obviously feel free to [add your own
keybindings](https://code.visualstudio.com/docs/getstarted/keybindings#_advanced-customization)
for other commands.

### Extempore share directory

The extempore "share directory" is just your `extempore` folder---the one with
`libs`, `examples`, `runtime` etc. For `Extempore Start` to be able to
automatically start Extempore in a new terminal, it needs to know where this
folder is. It tries to figure this out by:

- if you've added a user setting for `extempore.sharedir` then it'll use that
  path
  
- if you opened the root `extempore` folder as your workspace folder in VSCode
  (e.g. if you're just messing with the examples) then it'll use that
  
- otherwise, it gives up and bombs out (you can still start extempore however
  you like, it's just that `Extempore Start` won't do it for you automagically)
  
If you're planning on doing a lot of Extempore coding, it's not a bad idea to
set that in your user settings. Open your user settings with `Preferences: Open
User Settings` and add a config entry which looks something like this:

```json
  "extempore.sharedir": "/Users/ben/extempore" 
```

Don't forget to replace `/Users/ben/extempore` (or `C:\Users\ben\extempore` or
whatever) with the path to the `extempore` folder on **your** machine. Also,
make sure your user settings file is still valid
[JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON)
after you've made your edits.

## Features

- start & manage Extempore processes using the built-in terminal
- syntax highlighting
- auto-indent on return
- snippets (see [snippets file](./snippets/extempore.json))

## TODO

- allow for multiple simultaneous connections (on different host/port)
- more snippets

## Changelog

- `0.0.1`: initial release

- `0.0.2`: prompt for host/port

- `0.0.3`: add `Extempore Start`, send selected region (if selection is active)

- `0.0.4`: top-level eval, pretty blinking on eval, sharedir stuff

- `0.0.5`:
  - improved formatting (sets `editor.formatOnType: true` by default)
  - use `EXTEMPORE_PATH` env var if set
  - add `Extempore Help` command to jump to docs website
  - plays nicer with paredit/parinfer

- `0.0.6`: more robust top-level eval (ignores brackets in strings/comments)

- `0.0.7`: more robust top-level eval

- `0.0.8`: actually robust top-level eval (honestly ;)

- `0.0.9`: 
  - fixed some indenting problems
  - added selection formatting
  - added snippets for play, mplay, loop, eloop, mloop, mcc

- `0.1.0`:
  - change "connect" command to just use default host/port---there's a new
    "connect to host/port" port when you need something other than the defauly
  - add an "Extempore: download binary" command (for macOS/Win, anyway)
  - make "eval" command work when cursor is just _after_ an s-expression

- `0.2.0`:
  - fix bug where the "download binary" command wasn't activated properly

- `0.2.1`: automatically detect & download the latest release with the "Download
  Binary" command

- `0.2.2`: no functional changes, but the extension is now bundled by webpack
  (should be leaner)

- `0.2.3`:
  - bugfix for broken folder paths (when using the "Download Binary" command)
  - add "do you want to download this large file" confirmation for Download
    Binary command

- `0.2.4`: bugfixes for misleading "secondary" error messages

- `0.2.5`: bugfix for incorrect download path in "Download Binary"

- `0.2.6`: make Extempore extension compatible with older VSCode versions

- `0.2.7`: add "start with CLI options" command

- `0.2.8`: refactor Extempore start command

- `0.2.9`: implemented `vscode.DocumentLinkProvider` for links passed to
  `sys:load` (thanks @stellartux)

- `0.2.10`: fix broken "Download Binary" command (download paths had changed)

## Developer Notes

To work on this VSCode extension (any help is appreciated!) you need to:

1. install the deps with `npm install`
2. [activate](https://code.visualstudio.com/docs/extensions/example-hello-world#_extension-activation) the extension
3. make it better
4. submit a pull request

## Licence

MIT
