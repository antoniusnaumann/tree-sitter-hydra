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

; `_` binds nothing: it is where a result is consumed and dropped (§8.1).
((identifier) @variable.builtin
  (#eq? @variable.builtin "_"))

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
(field_continuation "." @punctuation.delimiter)

(qualified_identifier "::" @punctuation.delimiter)

; ------------------------------------------------------------------- literals

(number) @constant.numeric

(string) @string

(escape_sequence) @constant.character.escape

(interpolation
  "\\(" @punctuation.special
  ")" @punctuation.special)

(comment) @comment

; Only an atom's payload is a constant; its colon is a delimiter.
(symbol (symbol_name) @constant)
(symbol (string) @constant)

; -------------------------------------------------------------- keys and tags

; `d.a` is a key lookup, and is exactly `d[:a]` (§5). This comes before the
; function rules on purpose: `d.f(…)` is a *call* — the field when it holds one,
; and otherwise `f(d, …)` (§5.2) — so the call rule below has to win over this
; one for the same node.
(field_expression
  key: (identifier) @variable.other.member)

(field_expression
  key: (string) @variable.other.member)

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

; The five builtins of the stdlib spec, the language primitives — `alive()`,
; `reject()` — and the three channel calls, which are lexically scoped to a
; block (channels §6.4).
(call_expression
  function: (identifier) @function.builtin
  (#any-of? @function.builtin
    "print" "has" "get" "len" "push" "alive" "send" "receive" "channel" "reject" "break" "continue"))

; `::name` with the module omitted is the language's own namespace, which is how
; a builtin is reached past a shadow (§7). The anchor is what says "no module".
(call_expression
  function: (qualified_identifier
    .
    "::"
    name: (identifier) @function.builtin)
  (#any-of? @function.builtin
    "print" "has" "get" "len" "push" "alive" "send" "receive" "channel" "reject" "break" "continue"))

; The `*` that closes a parameter list is not multiplication (channels §6.1),
; and neither is the one that asks for a module's names unqualified (§7).
(parameter
  "*" @punctuation.special)

(use_statement
  "*" @punctuation.special)

; ----------------------------------------------------------------- namespaces

(use_statement
  module: (identifier) @namespace)

(use_statement
  alias: (identifier) @namespace)

(qualified_identifier
  module: (identifier) @namespace)

; --------------------------------------------------------------------- labels

(label
  name: (identifier) @label)

; A continued field in a parallel column has its receiver in the previous row.
(field_continuation
  key: (identifier) @variable.other.member)

(field_continuation
  key: (string) @variable.other.member)

(call_expression
  function: (field_continuation
    key: (identifier) @function))

(call_expression
  function: (field_continuation
    key: (qualified_identifier
      name: (identifier) @function)))

; Standard control handlers share return's control-flow highlighting.
(symbol
  (symbol_name) @keyword.control.return
  (#any-of? @keyword.control.return "exit" "panic" "reject"))

(symbol
  (string) @keyword.control.return
  (#any-of? @keyword.control.return "\"exit\"" "\"panic\"" "\"reject\""))

(call_expression
  function: (identifier) @keyword.control.return
  (#any-of? @keyword.control.return "exit" "panic" "reject"))

(call_expression
  function: (qualified_identifier
    . "::"
    name: (identifier) @keyword.control.return)
  (#any-of? @keyword.control.return "exit" "panic" "reject"))
