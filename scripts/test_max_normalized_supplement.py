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
            fit.update(profiles=[3,7]); fit['solver']=dict(backend='analytic',method='two-point',starts=0,epochs=0); fit['evaluation']['relativeRms']=0
            fits[identity+':'+metric]=fit
        local=dict(version=1,coverage='60',cohort='all',stateMode='merged',contexts=contexts,fits=fits,provenance={})
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

    def test_multiple_coverages_and_tiny_selections(self):
        self.add_local(); old=self.asset['localEmbeddings']
        self.rebuilt['display']['merged']['70']=copy.deepcopy(self.rebuilt['display']['merged']['60'])
        levels={q:{**{k:v for k,v in old.items() if k not in ('fits','revision')},'coverage':q} for q in ('60','70')}
        for q,level in levels.items():
            level['revision']=digest(dict(version=1,coverage=q,cohort='all',stateMode='merged',contexts=level['contexts'],fits=old['fits'],provenance={}))
        local=dict(version=2,cohort='all',stateMode='merged',levels=levels,fits=old['fits'])
        local['revision']=digest(local);self.asset['localEmbeddings']=local
        self.asset['revision']=digest({k:v for k,v in self.asset.items() if k!='revision'})
        validate(self.asset,self.rebuilt,'b')
        self.assertEqual(levels['60']['revision'],old['revision'])
        # A wrong per-coverage identity cannot be concealed by a new outer checksum.
        levels['70']['revision']='wrong'
        local['revision']=digest({k:v for k,v in local.items() if k!='revision'})
        self.asset['revision']=digest({k:v for k,v in self.asset.items() if k!='revision'})
        with self.assertRaisesRegex(ValueError,'level checksum'):validate(self.asset,self.rebuilt,'b')

    def test_singleton_error_is_unavailable(self):
        self.add_local();old=self.asset['localEmbeddings'];fits=old['fits'].copy()
        assignments=[None,None,None,'1,2',None,None,None,'3,4']
        self.rebuilt['display']['merged']['100']={'pairs':assignments}
        contexts={}
        for profile,group in [(3,'1,2'),(7,'3,4')]:
            identity=digest([profile])
            for key in ['group:'+group]+['vertex:'+v for v in group.split(',')]:contexts[key]=identity
            for metric in ('euclidean','linf'):
                coords=[[0,0,0]]
                fits[identity+':'+metric]=dict(profiles=[profile],coordinates=coords,coordinateSha256=digest(coords),metric=metric,
                    solver=dict(backend='analytic',method='singleton',starts=0,epochs=0),
                    evaluation=dict(profiles=1,pairs=0,zeroPairs=0,sampled=False,relativeRms=None))
        level=dict(version=1,coverage='100',cohort='all',stateMode='merged',contexts=contexts,
            fits={k:v for k,v in fits.items() if len(v['profiles'])==1},provenance={})
        level['revision']=digest(level)
        local=dict(version=2,cohort='all',stateMode='merged',levels={
            '60':{k:v for k,v in old.items() if k!='fits'},'100':{k:v for k,v in level.items() if k!='fits'}},fits=fits)
        local['revision']=digest(local);self.asset['localEmbeddings']=local
        self.asset['revision']=digest({k:v for k,v in self.asset.items() if k!='revision'})
        validate(self.asset,self.rebuilt,'b')
        next(v for v in fits.values() if len(v['profiles'])==1)['evaluation']['relativeRms']=0
        local['revision']=digest({k:v for k,v in local.items() if k!='revision'})
        self.asset['revision']=digest({k:v for k,v in self.asset.items() if k!='revision'})
        with self.assertRaisesRegex(ValueError,'evaluation'):validate(self.asset,self.rebuilt,'b')

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
