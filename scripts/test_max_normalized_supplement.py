import copy
import unittest
from max_normalized_supplement import digest, validate


class SupplementTests(unittest.TestCase):
    def setUp(self):
        self.rebuilt = dict(display=dict(revision='s', eligibleProfiles=[3, 7]),
            records=dict(adapter=dict(records=[dict(id='a', profile=3), dict(id='b', profile=7)]),
                participants=dict(provenance=dict(matrixSha256='matrix'))))
        self.asset = dict(version=1, baseRevision='b', sensitivityRevision='s', recordCount=2,
            matrixSha256='matrix', recordMappingSha256=digest([('a', 3), ('b', 7)]), profiles=[3, 7], views={})
        for metric in ('euclidean', 'linf'):
            coords = [[0, 0, 0], [1, 0, 0]]
            self.asset['views']['maxnorm-'+metric] = dict(metric=metric, coordinates=coords,
                coordinateSha256=digest(coords), solver=dict(backend='sgd', epochs=200, starts=1),
                evaluation=dict(profiles=2, sampled=False, pairs=1, zeroPairs=0, relativeRms=0.1))
        self.asset['revision'] = digest(self.asset)

    def test_matching_population(self):
        validate(self.asset, self.rebuilt, 'b')

    def test_reject_wrong_population_and_coordinates(self):
        for change in (lambda a: a.update(sensitivityRevision='other'),
                       lambda a: a.update(recordMappingSha256='other'),
                       lambda a: a.update(matrixSha256='other'),
                       lambda a: a['views']['maxnorm-linf']['coordinates'][0].__setitem__(0, 4),
                       lambda a: a['views']['maxnorm-linf']['evaluation'].update(pairs=0)):
            bad = copy.deepcopy(self.asset); change(bad)
            with self.assertRaises(ValueError):
                validate(bad, self.rebuilt, 'b')


if __name__ == '__main__':
    unittest.main()
