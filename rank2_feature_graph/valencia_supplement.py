"""Validate separately distributed VALENCIA2 annotations against their dataset."""
import hashlib
import json
import math

SUBTYPES = ['I-A', 'I-B', 'II', 'III-A', 'III-B', 'IV-A', 'IV-B',
            'IV-C0', 'IV-C1', 'IV-C2', 'IV-C3', 'IV-C4', 'V']
REFERENCE_SHA = 'e6045ccd7350eb45a5621eb35feff2e61ffcc00fcc3fb9299ec15b07cdac4c64'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                    allow_nan=False).encode()).hexdigest()


def population_identity(bundle, participants):
    return digest(dict(dataset=bundle['dataset']['id'], revision=bundle['dataset']['revision'],
                       ids=bundle['data']['samples']['ids'], features=participants['features'],
                       compositions=participants['compositions'],
                       records=[(r['id'], r['profile']) for r in participants['records']]))


def validate(asset, bundle, participants):
    def require(ok, message):
        if not ok:
            raise ValueError('VALENCIA2 supplement: ' + message)
    require(asset.get('version') == 1, 'unsupported format')
    require((asset.get('datasetId'), asset.get('datasetRevision')) ==
            (bundle['dataset']['id'], bundle['dataset']['revision']), 'dataset identity differs')
    require(asset.get('populationSha256') == population_identity(bundle, participants),
            'sample identities or compositions differ')
    require(asset.get('revision') == digest({k: v for k, v in asset.items() if k != 'revision'}),
            'content checksum differs')
    require(asset.get('referenceSha256') == REFERENCE_SHA and asset.get('subtypes') == SUBTYPES,
            'reference differs')
    require([r['id'] for r in asset['profiles']] == bundle['data']['samples']['ids'],
            'profile order differs')
    require([(r['id'], r['profile']) for r in asset['records']] ==
            [(r['id'], r['profile']) for r in participants['records']], 'record mapping differs')
    require(len({r['id'] for r in asset['records']}) == len(asset['records']), 'duplicate record ID')
    for row in asset['profiles']:
        scores = row['scores']
        require(len(scores) == len(SUBTYPES) and all(isinstance(x, (int, float)) and
                math.isfinite(x) and 0 <= x <= 1 + 1e-12 for x in scores), 'invalid similarities')
        order = sorted(range(len(scores)), key=lambda i: -scores[i])
        a, b = order[:2]
        subtype = SUBTYPES[a]
        cst = 'I' if subtype.startswith('I-') else 'III' if subtype.startswith('III-') else 'IV-C' if subtype.startswith('IV-C') else subtype
        require(row['subCST'] == subtype and row['cst'] == cst and row['runnerUp'] == SUBTYPES[b],
                'classification disagrees with scores')
        require(abs(row['score'] - scores[a]) <= 1e-12 and
                abs(row['margin'] - (scores[a] - scores[b])) <= 1e-12 and
                row['tieCount'] == sum(abs(x-scores[a]) <= 1e-12 for x in scores), 'diagnostics differ')
        require(math.isfinite(row['matchedFraction']) and 0 <= row['matchedFraction'] <= 1+1e-12,
                'invalid matched abundance')
    for row in asset['records']:
        require(isinstance(row['profile'], int) and 0 <= row['profile'] < len(asset['profiles']),
                'invalid record profile')
        require(isinstance(row.get('historical', {}).get('labels'), list) and
                isinstance(row['historical'].get('status'), str), 'missing historical-label provenance')
    return asset
