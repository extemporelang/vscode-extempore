# vscode-extempore

An [Extempore](https://extemporelang.github.io) language extension for Visual
Studio Code.

## Installation

Install it through the Extensions view (`View > Extensions`).

## Use

1. open up an Extempore file (with an `.xtm`) file extension.
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
User Settings` and add a config entry which looks like this:

```json
  "extempore.sharedir": "/Users/ben/extempore" 
```

Don't forget to replace `/Users/ben/extempore` (or `C:\Users\ben\extempore` or
whatever) with the path to the `extempore` folder on **your** machine. Also,
make sure your user settings file is still valid
[JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON)
after you've made your edits.

## Features

* start & manage Extempore processes using the built-in terminal
* Syntax highlighting
* Auto-indent on return
* Snippets: two example snippets are provided (tr: temporal recursion bf: bind-func)

## TODO

- allow for multiple simultaneous connections (on different host/port)
- more snippets
- play nice with paredit/parinfer/other fancy editing tools

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

- `0.0.7`: more robust top-level evel

## Developer Notes

To work on this VSCode extension (any help is appreciated!) you need to:

1. install the deps with `npm install`
2. [activate](https://code.visualstudio.com/docs/extensions/example-hello-world#_extension-activation) the extension
3. make it better
4. submit a pull request

## Licence

MIT
