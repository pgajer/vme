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

    def add_local(self):
        self.rebuilt['display'].update(merged={'60':{'pairs':[None,None,None,'1,2',None,None,None,'1,2']}},rank1={})
        identity=digest([3,7]); contexts={k:identity for k in ('group:1,2','vertex:1','vertex:2')}
        fits={}
        for metric in ('euclidean','linf'):
            fit=copy.deepcopy(self.asset['views']['maxnorm-'+metric])
            fit.update(profiles=[3,7]); fit['solver'].update(seed=17,pivots=1)
            fits[identity+':'+metric]=fit
        local=dict(version=1,cohort='all',stateMode='merged',coverage='60',contexts=contexts,fits=fits)
        local['revision']=digest(local)
        self.asset['populationRevision']=self.asset['revision']; self.asset['localEmbeddings']=local
        self.asset['revision']=digest({k:v for k,v in self.asset.items() if k!='revision'})

    def test_local_membership_and_original_population_identity(self):
        self.add_local(); validate(self.asset,self.rebuilt,'b')
        for change in (lambda a:a['localEmbeddings']['contexts'].pop('vertex:2'),
                       lambda a:a['localEmbeddings'].update(coverage='70'),
                       lambda a:a.update(populationRevision='wrong'),
                       lambda a:next(iter(a['localEmbeddings']['fits'].values()))['profiles'].reverse()):
            bad=copy.deepcopy(self.asset);change(bad)
            local=bad['localEmbeddings'];local['revision']=digest({k:v for k,v in local.items() if k!='revision'})
            bad['revision']=digest({k:v for k,v in bad.items() if k!='revision'})
            with self.assertRaises(ValueError):validate(bad,self.rebuilt,'b')

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
