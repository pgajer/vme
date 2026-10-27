"""On-demand annotation identity/diagnostic checks; no private data required."""
import copy
import unittest
from valencia_supplement import SUBTYPES, REFERENCE_SHA, digest, population_identity, validate


class ValenciaSupplementTest(unittest.TestCase):
    def setUp(self):
        self.bundle = dict(dataset=dict(id='fixture', revision='v1'),
                           data=dict(samples=dict(ids=['p1', 'p2'])))
        self.participants = dict(features=['Lactobacillus_iners'],
                                 compositions={'0': [[0, 1.0]], '1': [[0, 1.0]]},
                                 records=[dict(id='A', profile=0), dict(id='B', profile=1)])
        scores = [0.0]*len(SUBTYPES); scores[3] = 1.0
        self.asset = dict(version=1, datasetId='fixture', datasetRevision='v1',
                          referenceSha256=REFERENCE_SHA, subtypes=SUBTYPES,
                          profiles=[dict(id=p, cst='III', subCST='III-A', runnerUp='I-A',
                                         scores=scores[:], score=1.0, margin=1.0, tieCount=1,
                                         matchedFraction=1.0) for p in ['p1', 'p2']],
                          records=[dict(r, historical=dict(status='not_supplied', labels=[]))
                                   for r in self.participants['records']],
                          populationSha256=population_identity(self.bundle, self.participants))
        self.seal()

    def seal(self):
        self.asset['revision'] = digest({k:v for k,v in self.asset.items() if k != 'revision'})

    def check(self):
        return validate(self.asset, self.bundle, self.participants)

    def test_accepts_and_does_not_modify(self):
        before = copy.deepcopy((self.asset, self.bundle, self.participants))
        self.check()
        self.assertEqual(before, (self.asset, self.bundle, self.participants))

    def test_wrong_dataset_and_revision(self):
        for field in ['datasetId', 'datasetRevision']:
            with self.subTest(field=field):
                a = copy.deepcopy(self.asset); a[field] = 'wrong'
                with self.assertRaisesRegex(ValueError, 'identity'): validate(a, self.bundle, self.participants)

    def test_wrong_composition(self):
        self.participants['compositions']['0'][0][1] = .9
        with self.assertRaisesRegex(ValueError, 'compositions'): self.check()

    def test_reordered_profiles(self):
        self.asset['profiles'].reverse(); self.seal()
        with self.assertRaisesRegex(ValueError, 'profile order'): self.check()

    def test_wrong_record_mapping(self):
        self.asset['records'][0]['profile'] = 1; self.seal()
        with self.assertRaisesRegex(ValueError, 'record mapping'): self.check()

    def test_wrong_call_even_with_valid_checksum(self):
        self.asset['profiles'][0]['subCST'] = 'I-A'; self.seal()
        with self.assertRaisesRegex(ValueError, 'classification'): self.check()

    def test_modified_payload(self):
        self.asset['profiles'][0]['matchedFraction'] = .5
        with self.assertRaisesRegex(ValueError, 'checksum'): self.check()

    def test_unmatched_mass_and_exact_tie(self):
        for p in self.asset['profiles']:
            p.update(scores=[0.0]*len(SUBTYPES), score=0.0, margin=0.0,
                     cst='I', subCST='I-A', runnerUp='I-B', tieCount=13, matchedFraction=0.0)
        self.seal(); self.check()


if __name__ == '__main__': unittest.main()
