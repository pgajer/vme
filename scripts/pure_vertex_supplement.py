"""Validate optional independent pure-state vertex fits against frozen data."""
import base64
import hashlib
import json
import math
import struct


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def catalogue(part):
    name = 'comb-V3V4-tx'
    adapter = part['recordAdapters'][name]
    data = next(b['data'] for b in part['bundles'] if b['dataset']['id'] == name)
    contexts, memberships = {}, {}
    for population, entry in adapter['populations'].items():
        for coverage, core in part['combDisplay']['pureCores'].items():
            selected = set(core)
            vertices = {}
            for index in entry['indices']:
                profile = adapter['records'][index]['profile']
                pair = data['samples']['pair'][profile]
                if pair in selected:
                    for vertex in pair.split(','):
                        vertices.setdefault(int(vertex), set()).add(profile)
            for vertex, profiles in vertices.items():
                profiles = sorted(profiles)
                identity = digest(profiles)
                memberships[identity] = profiles
                key = json.dumps([population, str(coverage), vertex], separators=(',', ':'))
                contexts[key] = identity
    return contexts, memberships


def package_part(package, manifest):
    from portable import checked_bytes
    return json.loads(checked_bytes(package / 'web', manifest['datasets']['comb-V3V4-tx']['parts'][0]))


def saved_fits(package, manifest):
    from portable import checked_bytes
    entry = manifest['datasets']['comb-V3V4-tx']
    for desc in entry['parts'] + entry['deferred']['combDisplay']['parts']:
        part = json.loads(checked_bytes(package / 'web', desc))
        yield from part.get('combDisplay', {}).get('fits', {}).items()


def validate(asset, part, originals):
    contexts, memberships = catalogue(part)
    name = 'comb-V3V4-tx'
    if (asset.get('version') != 1 or asset.get('normalization') != 'sum'
            or asset.get('metric') != 'euclidean'
            or asset.get('populationRevision') != part['combDisplay']['revision']
            or asset.get('matrixSha256') != part['participants'][name]['provenance']['matrixSha256']
            or asset.get('recordMappingSha256') != digest(sorted((r['id'], r['profile']) for r in part['recordAdapters'][name]['records']))
            or asset.get('contexts') != contexts or set(asset.get('fits', {})) != set(memberships)
            or asset.get('revision') != digest({k: v for k, v in asset.items() if k != 'revision'})):
        raise ValueError('Pure vertex supplement identity or selection catalogue differs')
    local_keys = {value for key, value in part['combDisplay']['contexts'].items() if json.loads(key)[0] in ('group', 'vertex')}
    for key, profiles in memberships.items():
        fit = asset['fits'][key]
        if fit.get('profiles') != profiles:
            raise ValueError('Pure vertex membership differs')
        if 'existingFit' in fit:
            original = originals.get(fit['existingFit'])
            if (fit['existingFit'] not in local_keys or not original or original['profiles'] != profiles
                    or digest(original) != fit.get('originalSha256')):
                raise ValueError('Reused local fit identity differs')
            continue
        raw = base64.b64decode(fit['coordinates'], validate=True)
        if (len(raw) != len(profiles)*24 or fit.get('coordinateEncoding') != 'float64-le-base64'
                or hashlib.sha256(raw).hexdigest() != fit.get('coordinateSha256')
                or not all(math.isfinite(v[0]) for v in struct.iter_unpack('<d', raw))):
            raise ValueError('Invalid pure vertex coordinates')
        e, s = fit['evaluation'], fit['solver']
        n = len(profiles)
        if (e['profiles'] != n or e['zeroPairs'] != 0 or not 0 <= e['pairs'] <= n*(n-1)//2
                or e['sampled'] != (e['pairs'] < n*(n-1)//2)
                or n > 1 and (not isinstance(e['relativeRms'], (int, float)) or not math.isfinite(e['relativeRms']) or e['relativeRms'] < 0)):
            raise ValueError('Invalid pure vertex evaluation')
        if n <= 4:
            if s['backend'] != 'analytic' or n > 1 and e['relativeRms'] > 1e-8:
                raise ValueError('Invalid analytic pure vertex fit')
        elif s['backend'] != 'sgd' or s['epochs'] != 200 or s['seed'] not in (17, 29) or s['starts'] != 1:
            raise ValueError('Invalid pure vertex SGD provenance')
