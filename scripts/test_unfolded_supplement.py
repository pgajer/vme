import base64,copy,struct,unittest
from unfolded_supplement import digest,validate

class SupplementTest(unittest.TestCase):
    def setUp(self):
        self.bundle={'dataset':{'id':'fixture','revision':'b'},'data':{'graphs':{'90':{'nodes':[{'id':1}]}},'vertexEmbeddings':{'mapping':{'90_1':'v'},'fits':{'v':{'indices':[0,1]}}}},'cohortAnalysis':{'specs':{},'fits':{}}}
        self.participants={'analysisRevision':'p','features':['a','b'],'compositions':{'0':[[0,1]],'1':[[1,1]]}}
        key=digest({'anchor':0,'profiles':[0,1]})
        fit={'anchor':0,'profiles':[0,1],'metric':'euclidean','coordinateEncoding':'float64-le-base64','coordinates':base64.b64encode(struct.pack('<6d',0,0,0,2,0,0)).decode(),'evaluation':{'profiles':2,'relativeRms':0},'solver':{'backend':'analytic'}}
        fit['receipt']=digest(fit)
        self.asset={'version':1,'dataset':'fixture','baseRevision':'b','analysisRevision':'p','settings':{'targets':'Euclidean distances after anchor-centered face rotation, without stretching'},'contexts':{'["all","pure","90","vertex","1"]':key},'fits':{key+':euclidean':fit}}
        self.seal()
    def seal(self):self.asset['revision']=digest({k:v for k,v in self.asset.items() if k!='revision'})
    def test_valid(self):validate(self.asset,self.bundle,self.participants)
    def test_wrong_anchor_even_if_resealed(self):
        next(iter(self.asset['fits'].values()))['anchor']=1;self.seal()
        with self.assertRaisesRegex(ValueError,'identity'):validate(self.asset,self.bundle,self.participants)
    def test_missing_context(self):
        self.asset['contexts']={};self.seal()
        with self.assertRaisesRegex(ValueError,'contexts'):validate(self.asset,self.bundle,self.participants)
    def test_stale_release(self):
        self.asset['baseRevision']='old';self.seal()
        with self.assertRaisesRegex(ValueError,'release'):validate(self.asset,self.bundle,self.participants)
    def test_bad_coordinates(self):
        fit=next(iter(self.asset['fits'].values()));fit['coordinates']=base64.b64encode(struct.pack('<6d',float('nan'),0,0,2,0,0)).decode();fit['receipt']=digest({k:v for k,v in fit.items() if k!='receipt'});self.seal()
        with self.assertRaisesRegex(ValueError,'coordinates'):validate(self.asset,self.bundle,self.participants)
if __name__=='__main__':unittest.main()
