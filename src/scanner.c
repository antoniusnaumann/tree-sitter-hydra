#include "tree_sitter/parser.h"
#include <string.h>
#include <stdlib.h>
#include <wctype.h>

enum TokenType {
  CONTINUATION, SOFT_NEWLINE, SYMBOL_NAME,
  OR_NEWLINE, AND_NEWLINE, COMPARE_NEWLINE, BIT_OR_NEWLINE,
  BIT_XOR_NEWLINE, BIT_AND_NEWLINE, SHIFT_NEWLINE, ADD_NEWLINE,
  MULTIPLY_NEWLINE, POSTFIX_NEWLINE, ASSIGN_NEWLINE, NAMESPACE_NEWLINE,
  PARALLEL_START, PARALLEL_END, ROW_NEWLINE, TRAIL_SEPARATOR,
  CELL_START, CONTINUED_CELL_START, COMMENT, STRING_CONTENT,
  ERROR_SENTINEL
};

// One bit per trail; state is serialized so incremental edits can change a
// newline into a blank line without leaving stale continuation highlighting.
#define TRAIL_BYTES 512
typedef struct {
  uint16_t column;
  bool in_rows, started, comment_only;
  uint8_t carry[TRAIL_BYTES];
} Scanner;

void *tree_sitter_hydra_external_scanner_create(void) { return calloc(1, sizeof(Scanner)); }
void tree_sitter_hydra_external_scanner_destroy(void *payload) { free(payload); }
unsigned tree_sitter_hydra_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *s = payload;
  unsigned size = sizeof(*s);
  const unsigned char *bytes = (const unsigned char *)s;
  while (size && bytes[size - 1] == 0) size--;
  memcpy(buffer, s, size);
  return size;
}
void tree_sitter_hydra_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  memset(payload, 0, sizeof(Scanner));
  if (length <= sizeof(Scanner)) memcpy(payload, buffer, length);
}
static bool carried(Scanner *s) {
  return s->column < TRAIL_BYTES * 8 && (s->carry[s->column / 8] & (1u << (s->column % 8)));
}
static void set_carry(Scanner *s, bool value) {
  if (s->column >= TRAIL_BYTES * 8) return;
  uint8_t mask = 1u << (s->column % 8);
  if (value) s->carry[s->column / 8] |= mask;
  else s->carry[s->column / 8] &= ~mask;
}

static bool ident_start(int32_t c) {
  return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}
static bool ident_char(int32_t c) { return ident_start(c) || (c >= '0' && c <= '9'); }
static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static bool delimiter(int32_t c) {
  return c == 0 || iswspace(c) || (c < 128 && strchr("()[]{},:\"", c) != NULL);
}

bool tree_sitter_hydra_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid) {
  Scanner *s = payload;
  if (valid[ERROR_SENTINEL]) return false;

  // External comments must never steal a literal `//` inside a string.
  if (valid[STRING_CONTENT]) {
    bool any = false;
    while (lexer->lookahead && lexer->lookahead != '"'
           && lexer->lookahead != '\\' && lexer->lookahead != '\n') {
      advance(lexer);
      any = true;
    }
    if (!any) return false;
    lexer->result_symbol = STRING_CONTENT;
    return true;
  }

  // Immediate, maximal atom names, with comments and trail separators intact.
  if (valid[SYMBOL_NAME] && ident_start(lexer->lookahead)) {
    do {
      int32_t c = lexer->lookahead;
      advance(lexer);
      if ((c == '/' || c == '|') && lexer->lookahead == c) break;
      lexer->mark_end(lexer);
    } while (!delimiter(lexer->lookahead));
    lexer->result_symbol = SYMBOL_NAME;
    return true;
  }

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') lexer->advance(lexer, true);
  if (lexer->lookahead == '/' && valid[COMMENT]) {
    advance(lexer);
    if (lexer->lookahead != '/') return false;
    while (lexer->lookahead && lexer->lookahead != '\n') advance(lexer);
    if (s->in_rows) s->comment_only = !s->started && s->column == 0;
    lexer->result_symbol = COMMENT;
    return true;
  }

  // Rows never continue into the neighboring column's physical text.
  if (s->in_rows || valid[PARALLEL_START]) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') lexer->advance(lexer, true);
    if (lexer->lookahead == '\n' && valid[PARALLEL_START]) {
      advance(lexer);
      memset(s, 0, sizeof(*s));
      s->in_rows = true;
      lexer->result_symbol = PARALLEL_START;
      return true;
    }
    if (!s->in_rows) return false;
    if (lexer->lookahead == '\n' && valid[ROW_NEWLINE]) {
      advance(lexer);
      if (!s->started && s->column == 0 && !s->comment_only) memset(s->carry, 0, sizeof(s->carry));
      else if (!s->started && !s->comment_only) set_carry(s, false);
      s->column = 0; s->started = false; s->comment_only = false;
      lexer->result_symbol = ROW_NEWLINE;
      return true;
    }
    if (lexer->lookahead == '|' && valid[TRAIL_SEPARATOR]) {
      advance(lexer);
      if (lexer->lookahead != '|') return false;
      advance(lexer);
      if (!s->started) set_carry(s, false);
      s->column++; s->started = false;
      lexer->result_symbol = TRAIL_SEPARATOR;
      return true;
    }
    if (s->started || (!valid[CELL_START] && !valid[CONTINUED_CELL_START])) return false;
    if (!lexer->lookahead || lexer->lookahead == '\n' || lexer->lookahead == '|') return false;

    // Inspect, but do not consume, the cell. Its tokens still belong to the
    // ordinary grammar and queries. Quotes and nesting protect internal `||`.
    lexer->mark_end(lexer);
    int32_t first = lexer->lookahead, last = 0;
    char word[16] = {0}; unsigned n = 0;
    while (ident_char(lexer->lookahead)) {
      if (n < sizeof(word) - 1) word[n++] = (char)lexer->lookahead;
      last = lexer->lookahead;
      advance(lexer);
    }
    if (valid[PARALLEL_END] && s->column == 0 && strcmp(word, "end") == 0) {
      while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') advance(lexer);
      if (!lexer->lookahead || lexer->lookahead == '\n' || lexer->lookahead == '/') {
        lexer->mark_end(lexer);
        memset(s, 0, sizeof(*s));
        lexer->result_symbol = PARALLEL_END;
        return true;
      }
      // `end || ...` is a cell; keep the zero-width marker at its start.
    }
    bool colon_operator = false;
    int depth = 0;
    bool quoted = false, escaped = false, body = false;
    while (lexer->lookahead && lexer->lookahead != '\n') {
      int32_t c = lexer->lookahead;
      advance(lexer);
      if (c == first && !last && first == ':') colon_operator = lexer->lookahead == ':' || lexer->lookahead == '=';
      if (quoted) {
        if (escaped) escaped = false;
        else if (c == '\\') escaped = true;
        else if (c == '"') quoted = false;
      } else {
        if (c == '/' && lexer->lookahead == '/') break;
        if (c == '|' && lexer->lookahead == '|' && depth == 0) break;
        if (c == '"') quoted = true;
        if (c == '(' || c == '[' || c == '{') depth++;
        if (c == ')' || c == ']' || c == '}') depth--;
      }
      if (!iswspace(c)) { last = c; body = true; }
    }
    bool continues = carried(s) && ((strchr(".([+-*/%&^=<>!", first) || colon_operator) || strcmp(word, "and") == 0 || strcmp(word, "or") == 0);
    bool can_carry = last && strcmp(word, "end") != 0 && strcmp(word, "else") != 0
      && strcmp(word, "use") != 0
      && strcmp(word, "fn") != 0 && !(strcmp(word, "return") == 0 && !body);
    unsigned kind = continues ? CONTINUED_CELL_START : CELL_START;
    if (!valid[kind]) return false;
    set_carry(s, can_carry);
    s->started = true;
    lexer->result_symbol = kind;
    return true;
  }

  bool newline_valid = valid[CONTINUATION] || valid[SOFT_NEWLINE];
  for (unsigned i = OR_NEWLINE; i <= NAMESPACE_NEWLINE; i++) newline_valid |= valid[i];
  if (!newline_valid) return false;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }
  if (lexer->lookahead != '\n') return false;
  advance(lexer);
  lexer->mark_end(lexer);

  // Look through comment-only lines without consuming them: they must remain
  // comment nodes for highlighting. A whitespace-only line is a hard boundary.
  for (;;) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') advance(lexer);
    if (lexer->lookahead != '/') break;
    advance(lexer);
    if (lexer->lookahead != '/') {
      unsigned kind = lexer->lookahead == '=' ? ASSIGN_NEWLINE : MULTIPLY_NEWLINE;
      if (valid[SOFT_NEWLINE]) kind = SOFT_NEWLINE;
      if (!valid[kind]) return false;
      lexer->result_symbol = kind;
      return true;
    }
    while (lexer->lookahead && lexer->lookahead != '\n') advance(lexer);
    if (lexer->lookahead == '\n') advance(lexer);
  }
  if (lexer->eof(lexer) || lexer->lookahead == '\n') return false;
  if (valid[SOFT_NEWLINE]) {
    lexer->result_symbol = SOFT_NEWLINE;
    return true;
  }

  unsigned kind = ERROR_SENTINEL;
  int32_t c = lexer->lookahead;
  advance(lexer);
  switch (c) {
    case '.': case '(': case '[': kind = POSTFIX_NEWLINE; break;
    case ')': case ']': case '}': case ',': kind = CONTINUATION; break;
    case ':': kind = lexer->lookahead == ':' ? NAMESPACE_NEWLINE : lexer->lookahead == '=' ? ASSIGN_NEWLINE : (ident_start(lexer->lookahead) || lexer->lookahead == '"') ? ERROR_SENTINEL : CONTINUATION; break;
    case '+': case '-': kind = lexer->lookahead == '=' ? ASSIGN_NEWLINE : ADD_NEWLINE; break;
    case '*': case '%': kind = lexer->lookahead == '=' ? ASSIGN_NEWLINE : MULTIPLY_NEWLINE; break;
    case '&': kind = lexer->lookahead == '=' ? ASSIGN_NEWLINE : BIT_AND_NEWLINE; break;
    case '^': kind = lexer->lookahead == '=' ? ASSIGN_NEWLINE : BIT_XOR_NEWLINE; break;
    case '|': kind = lexer->lookahead == '|' ? ERROR_SENTINEL : lexer->lookahead == '=' ? ASSIGN_NEWLINE : BIT_OR_NEWLINE; break;
    case '=': kind = lexer->lookahead == '=' ? COMPARE_NEWLINE : ASSIGN_NEWLINE; break;
    case '!': kind = lexer->lookahead == '=' ? COMPARE_NEWLINE : ERROR_SENTINEL; break;
    case '<': case '>':
      kind = COMPARE_NEWLINE;
      if (lexer->lookahead == c) {
        kind = SHIFT_NEWLINE;
        do { advance(lexer); } while (lexer->lookahead == c);
        if (lexer->lookahead == '=') kind = ASSIGN_NEWLINE;
      }
      break;
    default:
      if (ident_start(c)) {
        char word[8] = {(char)c};
        unsigned n = 1;
        while (ident_char(lexer->lookahead)) {
          if (n >= sizeof(word) - 1) return false;
          word[n++] = (char)lexer->lookahead;
          advance(lexer);
        }
        if (strcmp(word, "and") == 0) kind = AND_NEWLINE;
        if (strcmp(word, "or") == 0) kind = OR_NEWLINE;
      }
  }
  // Parameter defaults and named arguments use the delimiter gap.
  if (kind == ASSIGN_NEWLINE && c == '=' && valid[CONTINUATION]) kind = CONTINUATION;
  if (kind == ERROR_SENTINEL || !valid[kind]) return false;
  lexer->result_symbol = kind;
  return true;
}
