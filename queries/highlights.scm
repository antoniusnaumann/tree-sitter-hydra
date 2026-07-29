; Hydra highlighting.
;
; The classes come from spec §13, mapped onto the standard capture names Helix
; and Neovim themes already know. Later patterns win, so the generic rules come
; first and the specific ones refine them.

; ---------------------------------------------------------------- identifiers

(identifier) @variable

; `ALL_CAPS` is convention only and has no semantics (§2), but it is what the
; reference colouring calls a constant.
((identifier) @constant
  (#match? @constant "^[A-Z][A-Z0-9_]*$"))

; ------------------------------------------------------------------- keywords

"fn" @keyword.function

"use" @keyword.control.import

[
  "if"
  "else"
] @keyword.control.conditional

[
  "for"
  "in"
  "while"
] @keyword.control.repeat

[
  "break"
  "continue"
  "end"
] @keyword.control

"return" @keyword.control.return

[
  "and"
  "or"
  "not"
] @keyword.operator

"as" @keyword

; `parallel`, `race` and every compound built on them are coloured as one unit
; (§13). A theme that does not know `keyword.control.concurrent` falls back to
; `keyword.control`.
[
  "parallel"
  "race"
] @keyword.control.concurrent

; The trail separator — not logical or; Hydra has no `||` operator (§2).
"||" @punctuation.special

; ------------------------------------------------------------------ operators

[
  ":="
  "="
  "=="
  "!="
  "==="
  "!=="
  "<"
  ">"
  "<="
  ">="
  "+"
  "-"
  "*"
  "/"
  "%"
  "|"
  "&"
  "^"
  "~"
  "<<"
  ">>"
  ">>>"
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ":"
] @punctuation.delimiter

(field_expression "." @punctuation.delimiter)

(qualified_identifier "::" @punctuation.delimiter)

; ------------------------------------------------------------------- literals

(number) @constant.numeric

(string) @string

(escape_sequence) @constant.character.escape

(interpolation
  "\\(" @punctuation.special
  ")" @punctuation.special)

(comment) @comment

; A symbol is an interned tag (§5). The children are captured too, so the dot
; and the name are never coloured apart.
(symbol) @string.special.symbol

(symbol
  (identifier) @string.special.symbol)

(symbol
  (string) @string.special.symbol)

; `.null` and `.false` are the falsy ones (§5); nothing else is special about
; them, but reading them as constants is what the reference colouring does.
((symbol) @constant.builtin.boolean
  (#any-of? @constant.builtin.boolean ".true" ".false"))

((symbol
  (identifier) @constant.builtin.boolean)
  (#any-of? @constant.builtin.boolean "true" "false"))

((symbol) @constant.builtin
  (#eq? @constant.builtin ".null"))

((symbol
  (identifier) @constant.builtin)
  (#eq? @constant.builtin "null"))

; ------------------------------------------------------------------ functions

(call_expression
  function: (identifier) @function)

(call_expression
  function: (qualified_identifier
    name: (identifier) @function))

(call_expression
  function: (field_expression
    key: (identifier) @function))

(function_definition
  name: (identifier) @function.declaration)

(function_head
  name: (identifier) @function.declaration)

(parameter
  name: (identifier) @variable.parameter)

(argument
  name: (identifier) @variable.parameter)

; The five builtins of the stdlib spec, plus the one language primitive.
(call_expression
  function: (identifier) @function.builtin
  (#any-of? @function.builtin "print" "has" "get" "len" "push" "alive"))

; `::name` with the module omitted is the language's own namespace, which is how
; a builtin is reached past a shadow (§7). The anchor is what says "no module".
(call_expression
  function: (qualified_identifier
    .
    "::"
    name: (identifier) @function.builtin)
  (#any-of? @function.builtin "print" "has" "get" "len" "push" "alive"))

; ----------------------------------------------------------------- namespaces

(use_statement
  module: (identifier) @namespace)

(qualified_identifier
  module: (identifier) @namespace)

; -------------------------------------------------------------- keys and tags

; `d.a` is a key lookup, and `d.a` is exactly `d[.a]` (§5).
(field_expression
  key: (identifier) @variable.other.member)

(field_expression
  key: (string) @variable.other.member)

; --------------------------------------------------------------------- labels

(label
  name: (identifier) @label)

(break_statement
  label: (identifier) @label)

(continue_statement
  label: (identifier) @label)

; `break trail` ends the innermost trail from any depth; `trail` is a reserved
; label, not an identifier (§9.6).
(break_statement
  "trail" @label)
