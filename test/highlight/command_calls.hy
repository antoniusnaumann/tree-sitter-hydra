  print :ready
//^ function
//      ^ punctuation.delimiter
//       ^ constant
  value := add 1, 2
//         ^ function
  return 1, 2
//^ keyword.control.return
  return
//^ keyword.control.return
  request := return(1)
//           ^ keyword.control.return
  alias := return
//         ^ variable
  reject "why"
//^ keyword.control.return
  exit 7
//^ keyword.control.return
  panic "why"
//^ keyword.control.return

  ::return 2
//  ^ keyword.control.return

  module::return 2
//        ^ function
  [:return, 1]
// ^ punctuation.delimiter
//  ^ keyword.control.return
  :"return"
//^ punctuation.delimiter
// ^ keyword.control.return
  :return-later
// ^ constant
  object.method 2
//       ^ function
