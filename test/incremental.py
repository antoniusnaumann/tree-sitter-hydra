"""Regression tests for blank-line edits in a running editor (Tree-sitter CLI required)."""
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class ContinuationEdits(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix="hydra-incremental-")
        cls.addClassCleanup(cls.directory.cleanup)
        cls.library = pathlib.Path(cls.directory.name) / "hydra.so"
        subprocess.run(["tree-sitter", "build", "-o", str(cls.library)], cwd=ROOT, check=True)

    def parse(self, source, edit=None):
        path = pathlib.Path(self.directory.name) / "edit.hy"
        path.write_text(source)
        command = ["tree-sitter", "parse", "--lib-path", str(self.library),
                   "--lang-name", "hydra", "--no-ranges", str(path)]
        if edit is not None:
            command += ["--edits", edit]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        self.assertIn(result.returncode, (0, 1), result.stdout + result.stderr)
        return result.stdout.split(str(path))[0]

    def check_edit(self, source, row, column, deleted, inserted):
        offset = sum(len(line) for line in source.splitlines(keepends=True)[:row]) + column
        fresh = source[:offset] + inserted + source[offset + deleted:]
        self.assertEqual(self.parse(source, f"{row},{column} {deleted} {inserted}"), self.parse(fresh))

    def test_insert_blank_line_before_lookup(self):
        self.check_edit("foo\n.bar\n", 1, 0, 0, "\n")

    def test_remove_blank_line_before_lookup(self):
        self.check_edit("foo\n\n.bar\n", 1, 0, 1, "")

    def test_insert_blank_row_in_parallel(self):
        self.check_edit("parallel\nfoo || bar\n.key || .key\nend\n", 2, 0, 0, "\n")

    def test_remove_blank_row_in_parallel(self):
        self.check_edit("parallel\nfoo || bar\n\n.key || .key\nend\n", 2, 0, 1, "")

    def test_colon_atom_does_not_continue(self):
        self.check_edit("foo\n:bar\n", 1, 0, 0, "\n")

    def test_empty_cell_changes_only_its_column(self):
        self.check_edit("parallel\nfoo || bar\n.key || .key\n.next || .next\nend\n", 2, 0, 4, "")


if __name__ == "__main__":
    unittest.main()
