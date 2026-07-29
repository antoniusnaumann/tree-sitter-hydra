; Indentation is tabs and is purely cosmetic — the parser ignores leading
; whitespace entirely, and blocks are closed by `end` (§1). So the only thing
; to say here is which constructs open a level and which token closes one.
;
; The formatter (`hydra fmt`) owns the canonical form, including the column
; padding inside a parallel block, which no editor should try to guess.

[
  (function_definition)
  (closure)
  (if_statement)
  (for_statement)
  (while_statement)
  (parallel_statement)
  (parallel_for_statement)
  (parallel_while_statement)
] @indent

[
  "end"
  "else"
] @outdent
