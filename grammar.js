/**
 * @file Hydra grammar for tree-sitter
 * @author Antonius Naumann
 * @license MIT
 *
 * Two things in here are not the usual thing, and both fall out of the same
 * rule: a newline terminates a statement (spec §1), so `\n` is deliberately
 * *not* an extra.
 *
 *   * **Compound keywords.** `else if`, `parallel for`, `parallel while`,
 *     `race for` and `race while` are single keywords whose internal whitespace
 *     is spaces or tabs and never a newline (§2). Because a newline is a token
 *     here, writing them as two adjacent tokens gets that rule for free: with
 *     `else` at the end of a line, the newline token forces the plain `else`
 *     branch and the `if` on the next line opens a nested statement.
 *
 *   * **Parallel blocks are parsed row-wise, not column-wise.** The language
 *     transposes: cell *k* of every row is concatenated into trail *k* and
 *     parsed as one statement list (§4). A parser that produces one tree per
 *     file cannot do that, so a row is a row here, and a cell holds either a
 *     one-line statement or the *header* of a block that continues down its own
 *     column — `if_head`, `for_head`, `end_marker` and friends. That is the
 *     shape an editor wants anyway: highlighting and selection follow the text
 *     as written.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Loosest to tightest, from the table in spec §3. Python's ordering, not C's,
// so that `flags | MASK == x` groups as `(flags | MASK) == x`.
const PREC = {
  or: 1,
  and: 2,
  not: 3,
  compare: 4,
  bit_or: 5,
  bit_xor: 6,
  bit_and: 7,
  shift: 8,
  add: 9,
  multiply: 10,
  unary: 11,
  postfix: 12,
};

export default grammar({
  name: "hydra",

  // No `\n`: it terminates a statement, so the grammar has to see it.
  extras: ($) => [/[ \t\r]/, $.comment],

  word: ($) => $.identifier,

  supertypes: ($) => [$._statement, $._expression],

  rules: {
    source_file: ($) =>
      seq(
        repeat(choice($._newline, seq($._statement, $._newline))),
        // A file that does not end in a newline still ends its last statement.
        optional($._statement),
      ),

    // A block is closed by `end`, never by indentation: leading whitespace is
    // purely cosmetic (§1).
    block: ($) => repeat1(choice($._newline, seq($._statement, $._newline))),

    _statement: ($) =>
      choice(
        $.use_statement,
        $.function_definition,
        $.if_statement,
        $.for_statement,
        $.while_statement,
        $.parallel_statement,
        $.parallel_for_statement,
        $.parallel_while_statement,
        $._simple_statement,
      ),

    // Everything that fits on one line, which is also everything a cell of a
    // parallel block may hold whole.
    _simple_statement: ($) =>
      choice(
        $.declaration,
        $.assignment,
        $.break_statement,
        $.continue_statement,
        $.return_statement,
        $.expression_statement,
      ),

    use_statement: ($) => seq("use", field("module", $.identifier)),

    function_definition: ($) =>
      seq(
        "fn",
        field("name", $.identifier),
        field("parameters", $.parameters),
        $._newline,
        optional(field("body", $.block)),
        "end",
      ),

    parameters: ($) =>
      seq("(", optional(seq($.parameter, repeat(seq(",", $.parameter)))), ")"),

    // `&name` requires the *call* to pass a reference (§5.1); `name = expr`
    // gives a default, and the two never combine.
    parameter: ($) =>
      seq(
        optional("&"),
        field("name", $.identifier),
        optional(seq("=", field("default", $._expression))),
      ),

    // `x := expr` declares and shadows; `x = expr` assigns outward (§6).
    declaration: ($) =>
      seq(field("name", $.identifier), ":=", field("value", $._expression)),

    assignment: ($) =>
      seq(field("target", $._expression), "=", field("value", $._expression)),

    if_statement: ($) =>
      seq(
        "if",
        field("condition", $._expression),
        $._newline,
        optional(field("consequence", $.block)),
        repeat($.else_if_clause),
        optional($.else_clause),
        "end",
      ),

    // One keyword with a space in it (§2) — never split across lines, which is
    // what the newline token guarantees.
    else_if_clause: ($) =>
      seq(
        "else",
        "if",
        field("condition", $._expression),
        $._newline,
        optional(field("body", $.block)),
      ),

    else_clause: ($) =>
      seq("else", $._newline, optional(field("body", $.block))),

    for_statement: ($) =>
      seq(
        "for",
        field("variable", $.identifier),
        "in",
        field("iterable", $._expression),
        optional(field("label", $.label)),
        $._newline,
        optional(field("body", $.block)),
        "end",
      ),

    while_statement: ($) =>
      seq(
        "while",
        field("condition", $._expression),
        optional(field("label", $.label)),
        $._newline,
        optional(field("body", $.block)),
        "end",
      ),

    // `as name` labels a loop or a block; `break name` targets it (§9.6).
    label: ($) => seq("as", field("name", $.identifier)),

    // The row form (§4). Every row carries the same number of `||`, which is
    // what makes the block's own `end` — the first line with none — unambiguous.
    parallel_statement: ($) =>
      seq(
        field("kind", choice("parallel", "race")),
        optional(field("label", $.label)),
        $._newline,
        repeat(choice($._newline, $.row)),
        "end",
      ),

    row: ($) =>
      seq(
        optional($.cell),
        repeat1(seq("||", optional($.cell))),
        $._newline,
      ),

    // One cell is one line of one trail: a whole statement, or the header of a
    // block whose body continues in the rows below it (§4).
    cell: ($) =>
      choice(
        $._simple_statement,
        $.use_statement,
        $.function_head,
        $.if_head,
        $.else_if_head,
        $.else_head,
        $.for_head,
        $.while_head,
        $.end_marker,
      ),

    function_head: ($) =>
      seq("fn", field("name", $.identifier), field("parameters", $.parameters)),

    if_head: ($) => seq("if", field("condition", $._expression)),

    else_if_head: ($) =>
      seq("else", "if", field("condition", $._expression)),

    else_head: ($) => "else",

    for_head: ($) =>
      seq(
        "for",
        field("variable", $.identifier),
        "in",
        field("iterable", $._expression),
        optional(field("label", $.label)),
      ),

    while_head: ($) =>
      seq(
        "while",
        field("condition", $._expression),
        optional(field("label", $.label)),
      ),

    end_marker: ($) => "end",

    parallel_for_statement: ($) =>
      seq(
        field("kind", choice("parallel", "race")),
        "for",
        field("variable", $.identifier),
        "in",
        field("iterable", $._expression),
        optional(field("label", $.label)),
        $._newline,
        optional(field("body", $.block)),
        "end",
      ),

    parallel_while_statement: ($) =>
      seq(
        field("kind", choice("parallel", "race")),
        "while",
        field("condition", $._expression),
        optional(field("label", $.label)),
        $._newline,
        optional(field("body", $.block)),
        "end",
      ),

    // `trail` is a reserved label, not an identifier: it ends the innermost
    // trail from any depth (§9.6).
    break_statement: ($) =>
      seq("break", optional(choice(field("label", $.identifier), "trail"))),

    continue_statement: ($) =>
      seq("continue", optional(field("label", $.identifier))),

    return_statement: ($) => seq("return", optional($._expression)),

    expression_statement: ($) => $._expression,

    _expression: ($) =>
      choice(
        $.identifier,
        $.qualified_identifier,
        $.number,
        $.string,
        $.symbol,
        $.list,
        $.dict,
        $.closure,
        $.call_expression,
        $.index_expression,
        $.field_expression,
        $.unary_expression,
        $.reference_expression,
        $.binary_expression,
        $.parenthesized_expression,
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // Whether a closure is single-expression or multi-line is decided by
    // whether anything follows the `)` on the same line (§3).
    closure: ($) =>
      seq(
        "fn",
        field("parameters", $.parameters),
        choice(
          field("body", $._expression),
          seq($._newline, optional(field("body", $.block)), "end"),
        ),
      ),

    call_expression: ($) =>
      prec(
        PREC.postfix,
        seq(field("function", $._expression), field("arguments", $.arguments)),
      ),

    arguments: ($) =>
      seq("(", optional(seq($.argument, repeat(seq(",", $.argument)))), ")"),

    // `f(a, width = 2)` fills a parameter by name (§3). There is no ambiguity
    // with assignment: assignment is a statement, so it never appears here.
    argument: ($) =>
      choice(seq(field("name", $.identifier), "=", $._expression), $._expression),

    index_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $._expression),
          "[",
          field("index", $._expression),
          "]",
        ),
      ),

    // `d.a` is exactly `d[.a]` (§5) — a dot directly after an expression is a
    // key lookup, and a dot in leading position opens a symbol.
    field_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $._expression),
          ".",
          field("key", choice($.identifier, $.string)),
        ),
      ),

    // `mod::name`, and `::name` with the module omitted — the language's own
    // namespace, which is how a builtin is reached past a shadow (§7).
    qualified_identifier: ($) =>
      prec(
        PREC.postfix,
        seq(optional(field("module", $.identifier)), "::", field("name", $.identifier)),
      ),

    unary_expression: ($) =>
      choice(
        prec.right(
          PREC.unary,
          seq(field("operator", choice("-", "~")), field("operand", $._expression)),
        ),
        prec.right(
          PREC.not,
          seq(field("operator", "not"), field("operand", $._expression)),
        ),
      ),

    // `&lvalue` passes a reference instead of a copy — the caller marks it,
    // never the callee (§5.1). It is the marker for shared mutable state.
    reference_expression: ($) =>
      prec.right(PREC.unary, seq("&", field("target", $._expression))),

    binary_expression: ($) => {
      const table = [
        ["or", PREC.or],
        ["and", PREC.and],
        ["==", PREC.compare],
        ["!=", PREC.compare],
        ["===", PREC.compare],
        ["!==", PREC.compare],
        ["<", PREC.compare],
        [">", PREC.compare],
        ["<=", PREC.compare],
        [">=", PREC.compare],
        ["|", PREC.bit_or],
        ["^", PREC.bit_xor],
        ["&", PREC.bit_and],
        ["<<", PREC.shift],
        [">>", PREC.shift],
        [">>>", PREC.shift],
        ["+", PREC.add],
        ["-", PREC.add],
        ["*", PREC.multiply],
        ["/", PREC.multiply],
        ["%", PREC.multiply],
      ];

      return choice(
        ...table.map(([operator, precedence]) =>
          prec.left(
            Number(precedence),
            seq(
              field("left", $._expression),
              field("operator", operator),
              field("right", $._expression),
            ),
          ),
        ),
      );
    },

    list: ($) =>
      seq("[", optional(seq($._expression, repeat(seq(",", $._expression)))), "]"),

    // Keys are symbols, always (§2).
    dict: ($) => seq("{", optional(seq($.pair, repeat(seq(",", $.pair)))), "}"),

    pair: ($) => seq(field("key", $.symbol), ":", field("value", $._expression)),

    // `.name`, `."content-type"`, and `."\(prefix)-id"` — a quoted symbol may
    // interpolate, which is how a symbol is built from data (§2).
    symbol: ($) => seq(".", field("name", choice($.identifier, $.string))),

    string: ($) =>
      seq(
        '"',
        repeat(choice($.string_content, $.escape_sequence, $.interpolation)),
        '"',
      ),

    string_content: (_) => token.immediate(prec(1, /[^"\\\n]+/)),

    escape_sequence: (_) => token.immediate(/\\["\\nrt0]/),

    // Lexed and parsed recursively, so it may contain calls and further strings
    // with their own interpolations (§1).
    interpolation: ($) => seq(token.immediate("\\("), $._expression, ")"),

    // 64-bit floats (§2). The fraction needs a digit after the dot so that
    // `3.foo` stays a key lookup on the number `3`.
    number: (_) => token(/[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/),

    // A leading underscore marks an item private: never exported, never
    // reachable through `::` (§2).
    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,

    comment: (_) => token(seq("//", /[^\n]*/)),

    _newline: (_) => token(/\r?\n/),
  },
});
