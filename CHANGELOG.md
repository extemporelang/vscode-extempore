# Changelog

## 0.4.0

- `Extempore: Install Extempore` (which was `Download binary`) installs the
  latest release where Extempore's install scripts do
  (`~/.local/share/extempore` on macOS and Linux,
  `%LOCALAPPDATA%\Programs\Extempore` on Windows), after checking it against the
  release's `SHA256SUMS`. There's nothing to set: with `extempore.executable`
  empty, the extension runs the installed Extempore, and VS Code's terminals
  have it on `PATH`. Run it again to upgrade
- `extempore.executable` defaults to empty: the installed Extempore, then
  `extempore` on `PATH`
- `(sys:load "libs/...")` links find the files of the Extempore being run, in
  the layout of Extempore v0.13.0's releases or the earlier one
- needs Extempore v0.13.0 or later to install; any Extempore with
  `extempore lsp` still runs

## 0.3.0

- the extension runs extempore's language server (`extempore lsp`) and evaluates
  through Extempore's nREPL server by default: results inline, errors marked on
  their forms, completion, hover, outline, folding and formatting with
  `extempore fmt`'s rules
- the raw socket on port 7099 is now the legacy transport
  (`extempore.transport: "legacy"`)
- commands are renamed (`extension.xtmeval` is now `extempore.evaluate`, and so
  on), so update any keybindings of your own which name the old ones
- new commands: evaluate file, interrupt evaluation, restart language server
- `Extempore: Download binary` finds the archives current releases publish, and
  sets `extempore.executable` as well as `extempore.sharedir`
- needs VS Code 1.100 or later
- with the legacy transport, each reply also goes to the Extempore output panel,
  and replies no longer run together
- syntax highlighting now covers Extempore's syntax, including xtlang types
- in an untrusted workspace, `extempore.executable` and `extempore.sharedir`
  come from user settings only
