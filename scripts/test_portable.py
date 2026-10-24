"""Portability failure boundaries, independent of private scientific files."""
import copy
from pathlib import Path
import tempfile
import unittest
import portable


class PortableTests(unittest.TestCase):
    def test_asset_identity_and_path_boundary(self):
        with tempfile.TemporaryDirectory() as temp:
            web = Path(temp); (web / 'vme-assets').mkdir()
            raw = b'{"value":1}'; digest = portable.sha(raw)
            desc = dict(url='/vme-assets/' + digest + '.json', sha256=digest, bytes=len(raw))
            path = web / desc['url'].lstrip('/'); path.write_bytes(raw)
            self.assertEqual(portable.checked_bytes(web, desc), raw)
            path.write_bytes(b'{"value":2}')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                portable.checked_bytes(web, desc)
            with self.assertRaisesRegex(ValueError, 'Invalid asset path'):
                portable.asset_path(web, dict(desc, url='/vme-assets/../../secret'))
            external = web / 'outside.json'; external.write_bytes(raw)
            path.unlink(); path.symlink_to(external)
            # Containment is package-wide, not limited to its asset subdirectory.
            self.assertEqual(portable.checked_bytes(web, desc), raw)

    def test_metadata_bindings(self):
        manifest = dict(version=1, datasets={'test': {'dataset': {'revision': 'r1'}}})
        views = {'v': ({'size': 2}, {'coordinateSha256': 'xyz', 'alignment': {'scale': 2}})}
        metadata = dict(version=1, baseManifestSha256=portable.sha(portable.encoded(manifest)),
                        datasetRevisions={'test': 'r1'}, legendAbundanceTotals={'test': {'datasetRevision': 'r1'}},
                        embeddingStressDiagnostics={'v': {'profiles': 2, 'fingerprint': {'coordinateSha256': 'xyz', 'scale': 2}}})
        portable.validate_metadata(metadata, manifest, views)
        bad = copy.deepcopy(metadata); bad['baseManifestSha256'] = 'other'
        with self.assertRaisesRegex(ValueError, 'different data package'):
            portable.validate_metadata(bad, manifest, views)
        bad = copy.deepcopy(metadata); bad['embeddingStressDiagnostics']['v']['fingerprint']['scale'] = 1
        with self.assertRaisesRegex(ValueError, 'coordinates differ'):
            portable.validate_metadata(bad, manifest, views)

    def test_existing_output_is_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp); sentinel = output / 'keep'; sentinel.write_text('unchanged')
            with self.assertRaisesRegex(ValueError, 'never overwritten'):
                portable.prepare(Path('absent'), Path('absent'), output)
            self.assertEqual(sentinel.read_text(), 'unchanged')

    def test_copy_accepts_copytree_strings(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source = root / 'source'; source.write_bytes(b'saved')
            portable.copy_file(str(source), str(root / 'nested/copy'))
            self.assertEqual((root / 'nested/copy').read_bytes(), b'saved')
            self.assertEqual(source.read_bytes(), b'saved')


if __name__ == '__main__':
    unittest.main()
