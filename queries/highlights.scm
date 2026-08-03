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
; (§13), and as control flow of the same weight as `return`: opening a block is
; where a program stops being one line of execution, which is worth seeing from
; across the file. `keyword.control.return` is the scope every theme already
; reserves for exactly that.
[
  "parallel"
  "race"
] @keyword.control.return

; The tail of a compound keyword goes with its head, or the keyword reads as two.
(parallel_for_statement
  "for" @keyword.control.return)

(parallel_while_statement
  "while" @keyword.control.return)

; The trail separator — not logical or; Hydra has no `||` operator (§2). It is
; where the trails part, so it is control flow too.
"||" @keyword.control.return

; ------------------------------------------------------------------ operators

[
  ":="
  "="
  "+="
  "-="
  "*="
  "/="
  "%="
  "|="
  "&="
  "^="
  "<<="
  ">>="
  ">>>="
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

; A symbol is an interned tag compared by identity (§5) — `.null` and `.true`
; are nothing but the ones the language happens to lean on, so every symbol is
; coloured alike. The children are captured too, so the dot and the name are
; never coloured apart.
(symbol) @constant.builtin

(symbol
  (symbol_name) @constant.builtin)

(symbol
  (string) @constant.builtin)

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
  name: (identifier) @function)

(function_head
  name: (identifier) @function)

(parameter
  name: (identifier) @variable.parameter)

(argument
  name: (identifier) @variable.parameter)

; The five builtins of the stdlib spec, the one language primitive, and the
; three channel calls, which are lexically scoped to a block (channels §6.4).
(call_expression
  function: (identifier) @function.builtin
  (#any-of? @function.builtin
    "print" "has" "get" "len" "push" "alive" "send" "receive" "channel"))

; `::name` with the module omitted is the language's own namespace, which is how
; a builtin is reached past a shadow (§7). The anchor is what says "no module".
(call_expression
  function: (qualified_identifier
    .
    "::"
    name: (identifier) @function.builtin)
  (#any-of? @function.builtin
    "print" "has" "get" "len" "push" "alive" "send" "receive" "channel"))

; The `*` that closes a parameter list is not multiplication (channels §6.1).
(parameter
  "*" @punctuation.special)

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
