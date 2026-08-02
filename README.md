# tree-sitter-hydra

A [tree-sitter](https://tree-sitter.github.io) grammar for
[Hydra](https://github.com/antoniusnaumann/hydra-lang), with highlighting,
indent, textobject and locals queries for Helix and Neovim.

```bash
tree-sitter generate
tree-sitter test
tree-sitter parse examples/tour.hy
```

## What is unusual about it

Both of the awkward parts come from the same rule: **a newline terminates a
statement** (spec §1), so `\n` is deliberately not an extra.

**Compound keywords.** `else if`, `parallel for`, `parallel while`, `race for`
and `race while` are single keywords whose internal whitespace is spaces or tabs
and *never* a newline (§2). Writing them as two adjacent tokens gets that rule
for free: with `else` at the end of a line, the newline token forces the plain
`else` branch, and the `if` on the next line opens a nested statement needing its
own `end` — which is exactly what the language says it means.

**Parallel blocks are parsed row-wise, not column-wise.** The language
transposes: cell *k* of every row is concatenated, in row order, into trail *k*
and parsed as one statement list (§4). A parser that produces one tree per file
cannot do that. So a row is a row here, and a cell holds either a whole one-line
statement or the *header* of a block that continues down its own column:

```hydra
parallel
	if ready  || for r in rs
		go()  ||   ping(r)
	end       || end
end
```

gives `(if_head)`, `(for_head)`, two statements, and two `(end_marker)`s — six
cells across three rows. That is the shape an editor wants anyway: highlighting
and selection follow the text as it is written, not as it is executed. What the
grammar does *not* do is check the language's separator discipline — that every
row carries the same number of `||` — because that is a semantic rule, and
`hydra check` reports it.

Anything a cell cannot hold, it does not accept: a `parallel` or `race` block may
not be written syntactically inside a cell (§4), and here it simply does not
parse.

## Auto-channels

The grammar covers `spec/hydra_channels.md` too: variadic parameters (`values*`
and the bare `*`), a comma list of targets on the left of `:=` and `=`, and
`return a, b`. `send`, `receive` and `channel` are ordinary calls — they are
lexically scoped to a block, but that is `hydra check`'s rule, not the parser's
— so they need nothing from the grammar beyond joining the builtin highlight
list.

The one conflict the grammar declares comes from here: after a name at the head
of a comma list, `a, b := …` declares and `a, b = …` assigns, and the name alone
does not say which.

## Queries

| File | What it does |
|---|---|
| `queries/highlights.scm` | The token classes of spec §13, under the capture names Helix and Neovim themes know. `parallel`, `race`, the tails of their compounds and `\|\|` are all `@keyword.control.return`: opening a block is where a program stops being one line of execution, and that is worth the same weight the language's other control flow gets. |
| `queries/indents.scm` | One level per block, closed by `end`. Indentation is cosmetic in Hydra — `hydra fmt` owns the canonical form, including the column padding inside a parallel block, which no editor should try to guess. |
| `queries/textobjects.scm` | Functions, parameters, entries, comments, and one cell as an entry. |
| `queries/locals.scm` | `:=` declarations, parameters, loop variables and labels. A cell stands in for a trail's scope: everything a trail declares with `:=` is local to it and gone at the join (§6). |

## Helix

```toml
# languages.toml
[[language]]
name = "hydra"
scope = "source.hydra"
file-types = ["hy"]
comment-tokens = "//"
indent = { tab-width = 4, unit = "\t" }
formatter = { command = "hydra", args = ["fmt", "-"] }
auto-format = true

[[grammar]]
name = "hydra"
source = { git = "https://github.com/antoniusnaumann/tree-sitter-hydra", rev = "…" }
```

Then copy `queries/` to `~/.config/helix/runtime/queries/hydra/` and run
`hx --grammar fetch && hx --grammar build`.
