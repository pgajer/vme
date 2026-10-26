import base64
import copy
import hashlib
import struct
import unittest
from pure_vertex_supplement import catalogue, digest, validate


def fixture():
    name = 'comb-V3V4-tx'
    part = dict(bundles=[dict(dataset=dict(id=name), data=dict(samples=dict(pair=['1,2', '1,2', '2,3'])))],
        participants={name: dict(provenance=dict(matrixSha256='matrix'))},
        recordAdapters={name: dict(records=[dict(id='a', profile=0), dict(id='duplicate', profile=0), dict(id='b', profile=1), dict(id='c', profile=2)],
            populations={'records': dict(indices=[0, 1, 2, 3]), 'cohort': dict(indices=[0, 1, 2])})},
        combDisplay=dict(revision='population', pureCores={'60': ['1,2'], '100': ['1,2', '2,3']},
            contexts={'["group","records",100,"1,2"]': 'saved'}))
    contexts, memberships = catalogue(part)
    originals = {'saved': dict(profiles=[0, 1], coordinates='existing', solver=dict(backend='sgd'))}
    fits = {}
    for key, pp in memberships.items():
        if pp == [0, 1]:
            fits[key] = dict(profiles=pp, existingFit='saved', originalSha256=digest(originals['saved']))
        else:
            raw = b''.join(struct.pack('<ddd', float(p), 0, 0) for p in pp)
            n = len(pp)
            fits[key] = dict(profiles=pp, coordinates=base64.b64encode(raw).decode(), coordinateEncoding='float64-le-base64',
                coordinateSha256=hashlib.sha256(raw).hexdigest(), solver=dict(backend='analytic'),
                evaluation=dict(profiles=n, zeroPairs=0, pairs=n*(n-1)//2, sampled=False, relativeRms=0 if n>1 else None))
    asset = dict(version=1, normalization='sum', metric='euclidean', populationRevision='population', matrixSha256='matrix',
        recordMappingSha256=digest(sorted((r['id'], r['profile']) for r in part['recordAdapters'][name]['records'])),
        contexts=contexts, fits=fits)
    asset['revision'] = digest(asset)
    return part, asset, originals


class PureVertexSupplementTest(unittest.TestCase):
    def test_exact_membership_and_duplicate_records(self):
        part, asset, originals = fixture()
        validate(asset, part, originals)
        self.assertEqual(asset['contexts']['["records","60",1]'], asset['contexts']['["cohort","100",1]'])
        self.assertEqual(asset['fits'][asset['contexts']['["records","60",1]']]['profiles'], [0, 1])

    def test_reject_mismatched_original(self):
        part, asset, originals = fixture()
        originals['saved']['profiles'] = [0, 2]
        with self.assertRaisesRegex(ValueError, 'Reused local fit'):
            validate(asset, part, originals)

    def test_reject_missing_selection_or_changed_matrix(self):
        for field in ('contexts', 'matrixSha256'):
            part, asset, originals = fixture()
            asset[field] = {} if field == 'contexts' else 'different'
            asset['revision'] = digest({k:v for k,v in asset.items() if k!='revision'})
            with self.assertRaisesRegex(ValueError, 'identity or selection'):
                validate(asset, part, originals)

    def test_reject_nonfinite_coordinates_even_with_valid_checksum(self):
        part, asset, originals = fixture()
        fit = next(f for f in asset['fits'].values() if 'existingFit' not in f)
        raw = base64.b64decode(fit['coordinates'])
        raw = struct.pack('<d', float('nan'))+raw[8:]
        fit.update(coordinates=base64.b64encode(raw).decode(), coordinateSha256=hashlib.sha256(raw).hexdigest())
        asset['revision'] = digest({k:v for k,v in asset.items() if k!='revision'})
        with self.assertRaisesRegex(ValueError, 'coordinates'):
            validate(asset, part, originals)


if __name__ == '__main__':
    unittest.main()
