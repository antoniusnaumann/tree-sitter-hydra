foo
  .bar
// ^ variable.other.member
  .method()
// ^ function

  :some-other-prop+interesting_added_info
// ^ constant

parallel
  foo || bar
  .key || .other
// ^ variable.other.member

  :atom || :atom
// ^ constant
end

text := "// still a string"
//        ^ string

status := :ready
//        ^ punctuation.delimiter
//         ^ constant
control := [:break, :continue]
//          ^ punctuation.delimiter
//           ^ constant
break()
// <- function.builtin
continue()
// <- function.builtin
config := {:name: "Hydra", :status: :ready}
//         ^ punctuation.delimiter
//          ^ constant
