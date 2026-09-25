  exit(7)
//^ keyword.control.return
  panic("why")
//^ keyword.control.return
  ::exit(2)
//  ^ keyword.control.return
  ::panic("why")
//  ^ keyword.control.return
  [:exit, 7]
//^ punctuation.bracket
// ^ punctuation.delimiter
//  ^ keyword.control.return
  [:panic, "why"]
// ^ punctuation.delimiter
//  ^ keyword.control.return
  [:exiting, :panic-later]
//  ^ constant
//            ^ constant
  [:"exit", 0]
//  ^ keyword.control.return
  module::exit(1)
//        ^ function
  reject("why")
//^ keyword.control.return
  ::reject("why")
//  ^ keyword.control.return
  [:reject, "why"]
// ^ punctuation.delimiter
//  ^ keyword.control.return
  [:"reject", "why"]
//  ^ keyword.control.return
  [:reject-later]
//  ^ constant
  module::reject("why")
//        ^ function
