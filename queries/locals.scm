; Function bodies, loop bodies, `if` bodies and trails each open a scope (§6).
; A trail is a column of a parallel block, which this parser sees row-wise, so
; a cell is as close to a trail scope as the tree gets — and since everything a
; trail declares with `:=` is local to that trail and gone at the join, scoping
; a cell is not wrong, only coarse.

[
  (source_file)
  (block)
  (closure)
  (cell)
] @local.scope

; `x := expr` declares `x` in the current scope, shadowing an existing name.
(declaration
  name: (identifier) @local.definition.variable)

(function_definition
  name: (identifier) @local.definition.function)

(parameter
  name: (identifier) @local.definition.variable.parameter)

(for_statement
  variable: (identifier) @local.definition.variable)

(parallel_for_statement
  variable: (identifier) @local.definition.variable)

(for_head
  variable: (identifier) @local.definition.variable)

(label
  name: (identifier) @local.definition)

(identifier) @local.reference
