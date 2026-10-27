"""Validate separately distributed dataset-specific max-normalized coordinates."""
import base64, hashlib, json, math, struct

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()

def validate(asset,bundle,participants,subjects=None):
    def require(ok,message):
        if not ok:raise ValueError('Max-normalized supplement: '+message)
    require(asset.get('version')==1,'unsupported format')
    require(asset.get('dataset')==bundle['dataset']['id'] and asset.get('baseRevision')==bundle['dataset']['revision'],'dataset identity differs')
    require(asset.get('analysisRevision')==participants['analysisRevision'],'analysis identity differs')
    require(asset['revision']==digest({k:v for k,v in asset.items() if k!='revision'}),'content checksum differs')
    fits=asset['fits'];profiles=set(map(int,participants['compositions']));members={}
    for key,fit in fits.items():
        identity,metric=key.split(':');pp=fit['profiles']
        require(pp==sorted(set(pp)) and bool(pp) and set(pp)<=profiles,'invalid profile membership')
        require(identity==digest(pp) and metric in ('euclidean','linf') and fit['metric']==metric,'fit identity differs')
        require(fit['receipt']==digest({k:v for k,v in fit.items() if k!='receipt'}),'fit checksum differs')
        require(fit['coordinateEncoding']=='float64-le-base64','unsupported coordinates')
        raw=base64.b64decode(fit['coordinates'],validate=True)
        require(len(raw)==len(pp)*24 and all(math.isfinite(v[0]) for v in struct.iter_unpack('<d',raw)),'incomplete/nonfinite coordinates')
        score=fit['evaluation'];solver=fit['solver']
        require(0<score['profiles']<=len(pp),'invalid distinct-composition count')
        require(score['relativeRms'] is None if score['profiles']==1 else isinstance(score['relativeRms'],(int,float)) and math.isfinite(score['relativeRms']) and score['relativeRms']>=0,'invalid distance diagnostic')
        require(solver['backend']=='analytic' if score['profiles']<3 else solver['backend']=='sgd' and solver['epochs']==200 and solver['seed'] in (17,29),'solver receipt differs')
        members[identity]=pp
    def membership(key,pp):
        require(key in members and members[key]==sorted(set(pp)),'context membership differs')
        require(all(key+':'+m in fits for m in ('euclidean','linf')),'missing metric')
    for cohort,key in asset['globals'].items():
        membership(key,[r['profile'] for r in participants['records'] if cohort=='all' or r['cohort']==cohort])
    require(set(asset['globals'])==set(bundle['cohortAnalysis']['populations']),'incomplete cohort globals')
    expected={};d=bundle['data'];a=bundle['cohortAnalysis']
    def context(cohort,mode,q,kind,key,pp):expected[json.dumps([cohort,mode,str(q),kind,str(key)],separators=(',',':'))]=pp
    for q,g in d['graphs'].items():
        context('all','pure',q,'overview','',d['overviewEmbeddings'][q]['indices'])
        for e in g['edges']:context('all','pure',q,'group',e['id'],d['localEmbeddings'][e['id']]['indices'])
        for n in g['nodes']:context('all','pure',q,'vertex',n['id'],d['vertexEmbeddings']['fits'][d['vertexEmbeddings']['mapping'][q+'_'+str(n['id'])]]['indices'])
    for s in a['specs'].values():
        context(s['cohort'],s['mode'],s['q'],'overview','',a['fits'][s['global']]['profileIndices'])
        for kind,field in [('group','states'),('vertex','vertices')]:
            for key,f in s[field].items():context(s['cohort'],s['mode'],s['q'],kind,key,a['fits'][f]['profileIndices'])
    require(set(expected)==set(asset['contexts']),'ordinary contexts incomplete')
    for context,pp in expected.items():membership(asset['contexts'][context],pp)
    # Independently reconstruct every packaged participant context from records.
    for context,key in asset['subjects'].items():
        ident,revision,analysis,audit,cohort,mode,q,states=json.loads(context)
        require((ident,revision,analysis,audit)==(asset['dataset'],asset['baseRevision'],participants['analysisRevision'],participants['provenance']['auditSha256']),'participant context identity differs')
        labels=a['merged'][q]['pairs'] if mode=='merged' else d['samples']['pair']
        membership(key,[r['profile'] for r in participants['records'] if r['cohort']==cohort and labels[r['profile']] in states])
    if subjects is not None:
        expected_subjects={k for k in subjects['contexts'] if json.loads(k)[0]==asset['dataset']}
        require(set(asset['subjects'])==expected_subjects,'participant contexts incomplete')
    require(set(fits)=={key+':'+metric for key in set(asset['globals'].values())|set(asset['contexts'].values())|set(asset['subjects'].values()) for metric in ('euclidean','linf')},'unused or missing fits')
    return asset
