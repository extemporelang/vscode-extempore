# Changelog

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
- in an untrusted workspace, `extempore.executable` and `extempore.sharedir` come
  from user settings only
