"""Validate optional anchor-unfolded coordinates against frozen vertex selections."""
import base64, math, struct
from dataset_maxnorm_supplement import digest

def vertex_contexts(bundle):
    expected={};d=bundle['data'];a=bundle['cohortAnalysis']
    def add(cohort,mode,q,vertex,profiles):
        import json
        context=json.dumps([cohort,mode,str(q),'vertex',str(vertex)],separators=(',',':'))
        expected.setdefault(context,dict(anchor=int(vertex)-1,profiles=sorted(set(profiles))))
    for q,g in d['graphs'].items():
        for node in g['nodes']:
            vertex=node['id'];fit=d['vertexEmbeddings']['fits'][d['vertexEmbeddings']['mapping'][q+'_'+str(vertex)]]
            add('all','pure',q,vertex,fit['indices'])
    for spec in a['specs'].values():
        for vertex,key in spec['vertices'].items():
            add(spec['cohort'],spec['mode'],spec['q'],vertex,a['fits'][key]['profileIndices'])
    return expected

def validate(asset,bundle,participants):
    def require(ok,message):
        if not ok:raise ValueError('Unfolded supplement: '+message)
    require(asset.get('version')==1,'unsupported format')
    require((asset.get('dataset'),asset.get('baseRevision'),asset.get('analysisRevision'))==(bundle['dataset']['id'],bundle['dataset']['revision'],participants['analysisRevision']),'release identity differs')
    require(asset['revision']==digest({k:v for k,v in asset.items() if k!='revision'}),'content checksum differs')
    require(asset['settings']['targets']=='Euclidean distances after anchor-centered face rotation, without stretching','target geometry differs')
    expected=vertex_contexts(bundle);require(set(expected)==set(asset['contexts']),'vertex contexts incomplete')
    required=set()
    for context,identity in expected.items():
        key=digest(identity);require(asset['contexts'][context]==key,'anchor/membership identity differs');required.add(key+':euclidean')
    require(set(asset['fits'])==required,'missing or unused fits')
    allowed=set(map(int,participants['compositions']))
    for key,fit in asset['fits'].items():
        pp=fit['profiles'];require(pp==sorted(set(pp)) and bool(pp) and set(pp)<=allowed,'invalid membership')
        require(0<=fit['anchor']<len(participants['features']),'invalid anchor')
        require(key==digest(dict(anchor=fit['anchor'],profiles=pp))+':euclidean' and fit['metric']=='euclidean','fit identity differs')
        require(fit['receipt']==digest({k:v for k,v in fit.items() if k!='receipt'}),'fit checksum differs')
        raw=base64.b64decode(fit['coordinates'],validate=True)
        require(fit['coordinateEncoding']=='float64-le-base64' and len(raw)==len(pp)*24 and all(math.isfinite(v[0]) for v in struct.iter_unpack('<d',raw)),'invalid coordinates')
        score=fit['evaluation'];n=score['profiles'];solver=fit['solver']
        require(0<n<=len(pp),'invalid distinct count')
        require(score['relativeRms'] is None if n==1 else isinstance(score['relativeRms'],(float,int)) and math.isfinite(score['relativeRms']) and score['relativeRms']>=0,'invalid evaluation')
        require(solver['backend']=='analytic' if n<3 else solver['backend']=='sgd' and solver['epochs']==200 and solver['seed'] in (17,29),'solver receipt differs')
    return asset
