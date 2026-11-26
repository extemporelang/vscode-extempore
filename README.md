# vscode-extempore

[Extempore](https://extemporelang.github.io) support for Visual Studio Code:
syntax highlighting and snippets, plus evaluation, completion, hover, formatting
and an outline through extempore's language server.

## Setup

1. install [Extempore](https://extemporelang.github.io/overview/quickstart/), or
   run `Extempore: Download binary` from the Command Palette
2. make sure VS Code can find the `extempore` binary: either it's on your
   `PATH`, or `extempore.executable` is set to its path (the download command
   sets this for you)
3. start Extempore with `Extempore: Start` (or however you like)
4. open an `.xtm` file and evaluate code with <kbd>ctrl</kbd>+<kbd>enter</kbd>
   (<kbd>cmd</kbd>+<kbd>enter</kbd> on macOS)

The extension runs `extempore lsp`, which connects to the running Extempore's
[nREPL server](https://extemporelang.github.io/guides/nrepl/). It finds the
server the same way `extempore send` does: `$EXTEMPORE_NREPL_PORT`, then a
`.nrepl-port` file in the file's folder or above it, then port 7888.

## Commands

| command                                           | keybinding                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `Extempore: Evaluate top-level form or selection` | <kbd>ctrl</kbd>/<kbd>cmd</kbd>+<kbd>enter</kbd>                  |
| `Extempore: Evaluate file`                        | <kbd>ctrl</kbd>/<kbd>cmd</kbd>+<kbd>shift</kbd>+<kbd>enter</kbd> |
| `Extempore: Interrupt evaluation`                 | <kbd>ctrl</kbd>/<kbd>cmd</kbd>+<kbd>alt</kbd>+<kbd>c</kbd>       |
| `Extempore: Start`                                |                                                                  |
| `Extempore: Restart language server`              |                                                                  |
| `Extempore: Download binary`                      |                                                                  |

Each result shows at the end of its form until you next edit the file. Errors
are also marked on their form, and everything the code prints goes to the
"Extempore" output panel. Formatting (`Format Document`, or
`editor.formatOnSave`) uses `extempore fmt`'s rules.

## Settings

| setting                   | default     | meaning                                                                                     |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `extempore.executable`    | `extempore` | the `extempore` binary                                                                      |
| `extempore.sharedir`      |             | where `Extempore: Start` runs extempore (else `$EXTEMPORE_PATH`, then the workspace folder) |
| `extempore.nrepl.host`    | `127.0.0.1` | the nREPL server's host                                                                     |
| `extempore.nrepl.port`    |             | the nREPL server's port, if not found as above                                              |
| `extempore.nrepl.process` |             | the Scheme process to evaluate in, e.g. `utility`                                           |
| `extempore.transport`     | `nrepl`     | `legacy` for an Extempore older than the nREPL server                                       |

## The legacy transport

Extempore releases before the nREPL server only accept code over a raw socket on
port 7099. Set `extempore.transport` to `legacy`, start Extempore, then run
`Extempore: Connect (legacy)` (or `Connect to host:port (legacy)`). Each
evaluated form's value shows in the status bar. `extempore.hostname` and
`extempore.port` set where it connects. Formatting and the outline still work if
your `extempore` binary has `extempore lsp`.

## Development

```sh
mise install
pnpm install
pnpm build        # dist/extension.js
pnpm check        # type-check
EXTEMPORE=/path/to/extempore pnpm test
pnpm package      # vscode-extempore-VERSION.vsix
```

Without `$EXTEMPORE` the tests which need a running Extempore are skipped.
