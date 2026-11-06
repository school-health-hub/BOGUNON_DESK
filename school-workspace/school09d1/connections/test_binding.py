import json
from pathlib import Path
import tempfile
import unittest
from verify_binding import verify, PROJECT, ROOT

class BindingTests(unittest.TestCase):
    def test_checked_repo(self):
        self.assertEqual(verify(ROOT, PROJECT), PROJECT)
    def test_other_project(self):
        with self.assertRaises(ValueError): verify(ROOT, "zbdnvdjleipnrprpwqyd")
    def test_denied(self):
        with self.assertRaises(ValueError): verify(ROOT, PROJECT, denied=True)
    def fixture(self, root, url, origin=None):
        (root / ".codex").mkdir()
        (root / "config").mkdir()
        (root / ".codex/config.toml").write_text('[mcp_servers.supabase_bogunon_ro]\nurl = ' + json.dumps(url))
        (root / "config/production-supabase.json").write_text(json.dumps({"origin": origin or "https://" + PROJECT + ".supabase.co"}))
    def test_read_only_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            self.fixture(root, "https://mcp.supabase.com/mcp?project_ref="+PROJECT)
            with self.assertRaises(ValueError): verify(root, PROJECT)
    def test_scoped_project_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            self.fixture(root, "https://mcp.supabase.com/mcp?project_ref=zbdnvdjleipnrprpwqyd&read_only=true")
            with self.assertRaises(ValueError): verify(root, PROJECT)
    def test_product_origin(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            self.fixture(root, "https://mcp.supabase.com/mcp?project_ref="+PROJECT+"&read_only=true", "https://zbdnvdjleipnrprpwqyd.supabase.co")
            with self.assertRaises(ValueError): verify(root, PROJECT)

if __name__ == "__main__": unittest.main()
