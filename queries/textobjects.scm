; Helix textobjects: `mif`, `maf`, `mip`, `map`, and so on.

(function_definition
  body: (block) @function.inside) @function.around

(closure
  body: (_) @function.inside) @function.around

(parameters
  (parameter) @parameter.inside) @parameter.around

(arguments
  (argument) @parameter.inside) @parameter.around

(list
  (_) @entry.inside) @entry.around

(dict
  (pair) @entry.inside) @entry.around

; One cell is one line of one trail (§4), which is the unit worth selecting
; inside a parallel block.
(cell) @entry.inside

(comment) @comment.inside

(comment)+ @comment.around
