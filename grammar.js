/**
 * @file Hydra grammar for tree-sitter
 * @author Antonius Naumann
 * @license MIT
 *
 * Newlines remain visible to the grammar: single newlines may continue an
 * expression, but blank lines end it. The external scanner recognizes soft
 * newlines without swallowing comments or weakening operator precedence.
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
// A compound assignment names its place once: the target is evaluated once,
// and the read and the write are one indivisible step (QUESTIONS.md §20).
const COMPOUND_ASSIGN = [
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "|=",
  "&=",
  "^=",
  "<<=",
  ">>=",
  ">>>=",
];

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

  // Newlines are contextual tokens, never unconditional whitespace.
  extras: ($) => [/[ \t\r]/, $.comment],

  externals: ($) => [
    $._continuation, $._soft_newline, $.symbol_name,
    $._or_newline, $._and_newline, $._compare_newline, $._bit_or_newline,
    $._bit_xor_newline, $._bit_and_newline, $._shift_newline, $._add_newline,
    $._multiply_newline, $._postfix_newline, $._assign_newline, $._namespace_newline,
    $._parallel_start, $._parallel_end, $._row_newline, $._trail_separator,
    $._cell_start, $._continued_cell_start, $.comment, $.string_content,
    $._error_sentinel,
  ],

  word: ($) => $.identifier,

  supertypes: ($) => [$._statement, $._expression],

  conflicts: ($) => [
    // A continued `=` can introduce a named argument or a parameter default.
    [$._expression, $.argument],
    [$.parameter],
    [$.declaration, $._expression],
  ],

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

    // Statements without a nested block. Expressions may span soft newlines.
    _simple_statement: ($) =>
      choice(
        $.declaration,
        $.assignment,
        $.return_statement,
        $.expression_statement,
      ),

    // `use fs` brings a module in for qualified calling only; `use fs as *`
    // binds its names unqualified as well, and `use fs as filesystem` puts the
    // qualified form under that name instead (§7).
    use_statement: ($) =>
      seq(
        "use",
        field("module", $.identifier),
        optional(seq("as", field("alias", choice("*", $.identifier)))),
      ),

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
      seq("(", soft($), optional(seq($.parameter, repeat(seq(cont($), ",", soft($), $.parameter)))), cont($), ")"),

    // `&name` requires the *call* to pass a reference (§5.1); `name = expr`
    // gives a default, and the two never combine. `name*` collects the rest of
    // the positional arguments into a list, and a bare `*` collects nothing —
    // either way, everything after it can be filled by name only
    // (channels §6.1).
    parameter: ($) =>
      choice(
        "*",
        seq(
          optional("&"),
          field("name", $.identifier),
          optional("*"),
          optional(seq(cont($), "=", soft($), field("default", $._expression))),
        ),
      ),

    // `x := expr` declares and shadows; `x = expr` assigns outward (§6). More
    // than one target takes a call that answers with several values, of which
    // the first is the meaningful one (channels §6.2).
    declaration: ($) =>
      seq(
        field("name", $.identifier),
        repeat(seq(cont($), ",", soft($), field("name", $.identifier))),
        cont($, "assign"), ":=", soft($),
        field("value", $._expression),
      ),

    assignment: ($) =>
      seq(
        field("target", $._expression),
        repeat(seq(cont($), ",", soft($), field("target", $._expression))),
        cont($, "assign"), field("operator", choice("=", ...COMPOUND_ASSIGN)), soft($),
        field("value", $._expression),
      ),

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

    // `as name` names a block for channel selection.
    label: ($) => seq("as", field("name", $.identifier)),

    // The row form (§4). Every row carries the same number of `||`, which is
    // what makes the block's own `end` — the first line with none — unambiguous.
    parallel_statement: ($) =>
      seq(
        field("kind", choice("parallel", "race")),
        optional(field("label", $.label)),
        $._parallel_start,
        repeat(choice($._row_newline, $.row)),
        alias($._parallel_end, "end"),
      ),

    row: ($) => seq(
      optional($.cell),
      repeat1(seq(alias($._trail_separator, "||"), optional($.cell))),
      $._row_newline,
    ),

    // The tree stays row-wise. The scanner remembers whether the preceding
    // cell in this column can continue, so a leading dot is a member only then.
    cell: ($) => choice(
      seq($._cell_start, choice(
        $._simple_statement, $.use_statement, $.function_head, $.if_head,
        $.else_if_head, $.else_head, $.for_head, $.while_head, $.end_marker,
      )),
      $.expression_statement,
      $.operator_continuation,
    ),

    field_continuation: ($) => seq(
      $._continued_cell_start, ".",
      field("key", choice($.identifier, $.string, $.qualified_identifier)),
    ),
    call_continuation: ($) => seq($._continued_cell_start, $.arguments),
    index_continuation: ($) => seq($._continued_cell_start, "[", $._expression, "]"),
    operator_continuation: ($) => seq(
      $._continued_cell_start,
      field("operator", choice("and", "or", "==", "!=", "===", "!==", "<", ">", "<=", ">=", "|", "^", "&", "<<", ">>", ">>>", "+", "-", "*", "/", "%", "=", ":=", ...COMPOUND_ASSIGN)),
      field("right", $._expression),
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

    // `return a, b`: the first value is the meaningful one and the rest are
    // additional information (channels §6.2).
    return_statement: ($) =>
      seq("return", optional(seq($._expression, repeat(seq(cont($), ",", soft($), $._expression))))),

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
        $.field_continuation,
        $.call_continuation,
        $.index_continuation,
      ),

    parenthesized_expression: ($) => seq("(", soft($), $._expression, cont($), ")"),

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
        seq(field("function", $._expression), cont($, "postfix"), field("arguments", $.arguments)),
      ),

    arguments: ($) =>
      seq("(", soft($), optional(seq($.argument, repeat(seq(cont($), ",", soft($), $.argument)))), cont($), ")"),

    // `f(a, width = 2)` fills a parameter by name (§3). There is no ambiguity
    // with assignment: assignment is a statement, so it never appears here.
    argument: ($) =>
      choice(seq(field("name", $.identifier), cont($), "=", soft($), $._expression), $._expression),

    index_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $._expression),
          cont($, "postfix"), "[", soft($),
          field("index", $._expression),
          cont($), "]",
        ),
      ),

    // `d.a` is exactly `d[:a]` (§5) — a dot directly after an expression is a
    // key lookup. A colon opens an atom.
    // The key may also be qualified — `path.fs::read(…)` is `fs::read(path, …)`
    // (§5.2, §7) — which only means anything with a call after it.
    field_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $._expression),
          cont($, "postfix"), ".", soft($),
          field("key", choice($.identifier, $.string, $.qualified_identifier)),
        ),
      ),

    // `mod::name`, and `::name` with the module omitted — the language's own
    // namespace, which is how a builtin is reached past a shadow (§7).
    qualified_identifier: ($) =>
      prec(
        PREC.postfix,
        seq(optional(seq(field("module", $.identifier), cont($, "namespace"))), "::", soft($), field("name", $.identifier)),
      ),

    unary_expression: ($) =>
      choice(
        prec.right(
          PREC.unary,
          seq(field("operator", choice("-", "~")), soft($), field("operand", $._expression)),
        ),
        prec.right(
          PREC.not,
          seq(field("operator", "not"), soft($), field("operand", $._expression)),
        ),
      ),

    // `&lvalue` passes a reference instead of a copy — the caller marks it,
    // never the callee (§5.1). It is the marker for shared mutable state.
    reference_expression: ($) =>
      prec.right(PREC.unary, seq("&", soft($), field("target", $._expression))),

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
              cont($, Object.keys(PREC).find(key => PREC[key] === precedence)), field("operator", operator), soft($),
              field("right", $._expression),
            ),
          ),
        ),
      );
    },

    list: ($) =>
      seq("[", soft($), optional(seq($._expression, repeat(seq(cont($), ",", soft($), $._expression)))), cont($), "]"),

    // Keys are symbols, always (§2).
    dict: ($) => seq("{", soft($), optional(seq($.pair, repeat(seq(cont($), ",", soft($), $.pair)))), cont($), "}"),

    pair: ($) => seq(field("key", $.symbol), cont($), ":", soft($), field("value", $._expression)),

    // Bare atoms consume punctuation until whitespace, ()[]{},:", // or ||.
    // The scanner gives symbol names maximal munch; lookups keep identifiers.
    symbol: ($) => seq(":", field("name", choice($.symbol_name, $.string))),


    string: ($) =>
      seq(
        '"',
        repeat(choice($.string_content, $.escape_sequence, $.interpolation)),
        '"',
      ),


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

    _newline: (_) => token(/\r?\n/),
  },
});

// A newline before an optional suffix needs lookahead; after an operator or
// opening delimiter the syntax already requires continuation.
function cont($, kind) { return optional(repeat1(kind ? $[`_${kind}_newline`] : $._continuation)); }
function soft($) { return optional(repeat1($._soft_newline)); }
