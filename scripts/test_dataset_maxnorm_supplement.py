import base64, copy, struct, unittest
from dataset_maxnorm_supplement import digest,validate

class DatasetMaxnorm(unittest.TestCase):
    def setUp(self):
        self.b={'dataset':{'id':'fixture','revision':'v1'},'data':{'graphs':{'60':{'edges':[{'id':'1,2'}],'nodes':[{'id':1}]}},'overviewEmbeddings':{'60':{'indices':[0,1]}},'localEmbeddings':{'1,2':{'indices':[0,1]}},'vertexEmbeddings':{'mapping':{'60_1':'v'},'fits':{'v':{'indices':[0,1]}}},'samples':{'pair':['1,2','1,2']}},'cohortAnalysis':{'populations':{'all':{}},'specs':{},'merged':{}}}
        self.p={'analysisRevision':'a','provenance':{'auditSha256':'audit'},'compositions':{'0':[[0,1]],'1':[[1,1]]},'records':[{'profile':0,'cohort':'all'},{'profile':1,'cohort':'all'}]}
        import json
        context=json.dumps(['fixture','v1','a','audit','all','pure','60',['1,2']],separators=(',',':'))
        key=digest([0,1]);fits={}
        for metric in ('euclidean','linf'):
            f={'profiles':[0,1],'metric':metric,'coordinateEncoding':'float64-le-base64','coordinates':base64.b64encode(struct.pack('<6d',0,0,0,1,0,0)).decode(),'solver':{'backend':'analytic'},'evaluation':{'profiles':2,'relativeRms':0}}
            f['receipt']=digest(f);fits[key+':'+metric]=f
        self.a={'version':1,'dataset':'fixture','baseRevision':'v1','analysisRevision':'a','globals':{'all':key},'contexts':{json.dumps(['all','pure','60',kind,value],separators=(',',':')):key for kind,value in [('overview',''),('group','1,2'),('vertex','1')]},'subjects':{context:key},'fits':fits}
        self.seal(self.a);self.s={'contexts':{context:'old'}}
    def seal(self,a):a['revision']=digest({k:v for k,v in a.items() if k!='revision'})
    def test_valid_frozen_bank(self):
        before=copy.deepcopy(self.a);validate(self.a,self.b,self.p,self.s);self.assertEqual(before,self.a)
    def test_malformed_and_stale_banks(self):
        for change in ('revision','coordinate','missing_metric','missing_subject','wrong_members','missing_context'):
            a=copy.deepcopy(self.a)
            if change=='revision':a['baseRevision']='wrong'
            elif change=='coordinate':next(iter(a['fits'].values()))['coordinates']='AA=='
            elif change=='missing_metric':a['fits'].pop(next(iter(a['fits'])))
            elif change=='missing_subject':a['subjects']={}
            elif change=='wrong_members':next(iter(a['fits'].values()))['profiles']=[0,99]
            else:a['contexts'].pop(next(iter(a['contexts'])))
            self.seal(a)
            with self.subTest(change=change),self.assertRaises(ValueError):validate(a,self.b,self.p,self.s)

if __name__=='__main__':unittest.main()
