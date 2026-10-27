"""Check shortcut routing without loading datasets or running the layout audit."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent


class ValidationShortcuts(unittest.TestCase):
    def test_routing(self):
        with tempfile.TemporaryDirectory(prefix='vme shortcuts ') as temp:
            base = Path(temp)
            scripts = base / 'source with spaces' / 'scripts'
            scripts.mkdir(parents=True)
            for name in ('vme-test', 'vme-test-audit', 'vme-test-layout'):
                shutil.copy2(SOURCE / name, scripts / name)
            bindir = base / 'bin'
            bindir.mkdir()
            node = bindir / 'node'
            node.write_text('#!' + sys.executable + '\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\nsys.exit(17)\n')
            node.chmod(0o755)
            env = {**os.environ, 'HOME': str(base / 'home'), 'PATH': str(bindir) + os.pathsep + os.defpath}
            env.pop('VME_TEST_PAGE', None)
            runner = str(scripts / '../rank2_feature_graph/verify_http_assets.mjs')

            def run(name, *args, environment=env):
                return subprocess.run([str(scripts / name), *args], cwd=base,
                                      env=environment, capture_output=True, text=True)

            for name, flags, target in [('vme-test', [], 'verify_http_assets.mjs'), ('vme-test-audit', ['--audit-layouts'], 'verify_http_assets.mjs'), ('vme-test-layout', [], 'verify_graph_layout.mjs')]:
                runner = str(scripts / '../rank2_feature_graph' / target)
                with self.subTest(command=name):
                    result = run(name)
                    self.assertEqual(result.returncode, 17, 'Propagate the test exit status')
                    self.assertEqual(json.loads(result.stdout), [runner, env['HOME'] + '/vme/web/index.html', *flags])
                    custom = {**env, 'VME_TEST_PAGE': '/custom build/index.http.html'}
                    result = run(name, environment=custom)
                    self.assertEqual(json.loads(result.stdout), [runner, custom['VME_TEST_PAGE'], *flags])
                    result = run(name, '/explicit build/index.html', environment=custom)
                    self.assertEqual(json.loads(result.stdout), [runner, '/explicit build/index.html', *flags])
                    result = run(name, '--help')
                    self.assertEqual(result.returncode, 0)
                    self.assertIn('Usage:', result.stdout)
                    for args in [('--unknown',), ('one.html', 'two.html')]:
                        self.assertEqual(run(name, *args).returncode, 2)
            self.assertEqual(run('vme-test-layout', '--audit-layouts').returncode, 2)
            runner = str(scripts / '../rank2_feature_graph/verify_http_assets.mjs')
            result = run('vme-test', '--audit-layouts', '/explicit build/index.html')
            self.assertEqual(json.loads(result.stdout), [runner, '/explicit build/index.html', '--audit-layouts'])


if __name__ == '__main__':
    unittest.main()
