#!/usr/bin/env python3
"""Package verified max-normalized fits as an optional, private VME supplement."""
import argparse
import copy
import csv
import hashlib
import json
import math
from pathlib import Path


def encoded(value):
    return json.dumps(value, separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def population(package, manifest):
    from portable import checked_bytes
    for desc in manifest.get('sensitivity', {}).get('parts', []):
        part = json.loads(checked_bytes(package / 'web', desc))
        rebuilt = part.get('sensitivityComparisons', {}).get('rebuilt')
        if rebuilt:
            return rebuilt
    raise ValueError('Package has no rebuilt-reference population')


def validate(asset, rebuilt, base_revision):
    display = rebuilt['display']
    records = rebuilt['records']['adapter']['records']
    profiles = display['eligibleProfiles']
    binding = sorted((r['id'], r['profile']) for r in records)
    if (asset.get('version') != 1 or asset.get('baseRevision') != base_revision
            or asset.get('sensitivityRevision') != display['revision']
            or asset.get('recordMappingSha256') != digest(binding)
            or asset.get('recordCount') != len(records)
            or asset.get('matrixSha256') != rebuilt['records']['participants']['provenance']['matrixSha256']
            or asset.get('profiles') != sorted(profiles) or len(set(profiles)) != len(profiles)):
        raise ValueError('Max-normalized supplement population or composition identity differs')
    if set(asset['views']) != {'maxnorm-euclidean', 'maxnorm-linf'}:
        raise ValueError('Both max-normalized metrics are required')
    for key, metric in [('maxnorm-euclidean', 'euclidean'), ('maxnorm-linf', 'linf')]:
        view = asset['views'][key]
        coords, evaluation, solver = view['coordinates'], view['evaluation'], view['solver']
        if (view['metric'] != metric or len(coords) != len(profiles)
                or any(len(row) != 3 or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in row) for row in coords)
                or view['coordinateSha256'] != digest(coords)):
            raise ValueError('Max-normalized coordinate identity differs')
        if (evaluation['profiles'] != len(profiles) or evaluation['sampled'] is not False
                or evaluation['pairs'] + evaluation['zeroPairs'] != len(profiles) * (len(profiles)-1)//2
                or not math.isfinite(evaluation['relativeRms']) or evaluation['relativeRms'] < 0
                or solver['backend'] != 'sgd' or solver['epochs'] <= 0 or solver['starts'] != 1):
            raise ValueError('Invalid max-normalized evaluation or solver metadata')
    content = {k: v for k, v in asset.items() if k != 'revision'}
    if asset['revision'] != digest(content):
        raise ValueError('Max-normalized supplement checksum differs')


def export(results, package, metadata_path, output):
    from portable import package_manifest, sha
    manifest = package_manifest(package)
    metadata = json.loads(metadata_path.read_text())
    if metadata['baseManifestSha256'] != digest(manifest):
        raise ValueError('Metadata belongs to a different package')
    rebuilt = population(package, manifest)
    records = rebuilt['records']['adapter']['records']
    expected_records = sorted((r['id'], r['profile']) for r in records)
    source_records = list(csv.DictReader((results / 'records.tsv').open(), delimiter='\t'))
    if sorted((r['id'], int(r['profile'])) for r in source_records) != expected_records:
        raise ValueError('Analysis record mapping differs from package')
    exact = json.loads((results / 'exact_summary.json').read_text())
    inputs = json.loads((results / 'input_manifest.json').read_text())
    # The original analysis froze the package scientific assets, not only its title.
    source_hashes = set(inputs['sources'].values())
    if (exact['identity']['input_sha'] != sha((results/'input_manifest.json').read_bytes())
            or not any(d['sha256'] in source_hashes for d in manifest['datasets']['comb-V3V4-tx']['parts'])):
        raise ValueError('Analysis input identity differs from the base dataset')
    if not any(d['sha256'] in source_hashes for d in manifest['sensitivity']['parts']):
        raise ValueError('Analysis has no matching frozen sensitivity asset')
    asset = dict(version=1, baseRevision=manifest['datasets']['comb-V3V4-tx']['dataset']['revision'],
                 sensitivityRevision=rebuilt['display']['revision'],
                 matrixSha256=rebuilt['records']['participants']['provenance']['matrixSha256'],
                 recordMappingSha256=digest(expected_records), recordCount=len(records),
                 profiles=sorted(rebuilt['display']['eligibleProfiles']), views={})
    for metric, label in [('euclidean', 'Euclidean'), ('linf', 'L∞')]:
        meta = json.loads((results / 'exports' / (metric + '_embedding.json')).read_text())
        task = meta['fit']['task']
        if task['input_manifest_sha'] != exact['identity']['input_sha'] or task['metric'] != metric or task['n'] != len(asset['profiles']):
            raise ValueError('Selected fit population or metric differs')
        fit_path = results / task['id'] / 'coordinates.tsv'
        if sha(fit_path.read_bytes()) != exact['metrics'][metric]['coordinates_sha']:
            raise ValueError('Exact evaluation and selected fit coordinates differ')
        rows = list(csv.DictReader((results / 'exports' / (metric + '_profiles.tsv')).open(), delimiter='\t'))
        if [int(r['profile']) for r in rows] != asset['profiles']:
            raise ValueError('Export profile order differs')
        coords = [[float(r[k]) for k in ('x', 'y', 'z')] for r in rows]
        fitted = [[float(r[k]) for k in ('x', 'y', 'z')] for r in csv.DictReader(fit_path.open(), delimiter='\t')]
        if coords != fitted:
            raise ValueError('Exported coordinates differ from the selected fit')
        preparation_path = results / Path(task['preparation']).relative_to(results) / 'manifest.json'
        if sha(preparation_path.read_bytes()) != task['constraint_manifest_sha']:
            raise ValueError('Fit preparation metadata differs')
        preparation = json.loads(preparation_path.read_text())
        asset['views']['maxnorm-' + metric] = dict(metric=metric, label='Max-normalized · ' + label,
            coordinates=coords, coordinateSha256=digest(coords),
            evaluation=dict(relativeRms=exact['metrics'][metric]['relative_rms_percent']/100,
                pairs=exact['metrics'][metric]['pairs'], zeroPairs=0, profiles=len(coords), sampled=False),
            solver=dict(backend=task['backend'], seed=task['seed'], starts=1, epochs=task['epochs'],
                pivots=preparation['pivots'], pivotSeed=preparation['pivot_seed'],
                localNeighbors=preparation['local_neighbors'], schedule=meta['fit']['metadata']['settings']['sgd_control']['scheduler'],
                proxyStress=meta['fit']['metadata']['sparse_proxy_stress']),
            provenance=dict(inputSha256=sha((results/'input_manifest.json').read_bytes()),
                selectedCoordinatesSha256=sha(fit_path.read_bytes()), exactEvaluationSha256=sha((results/'exact_summary.json').read_bytes()),
                gripSourceSha256=digest(task['source_identity'])))
    asset['revision'] = digest(asset)
    validate(asset, rebuilt, asset['baseRevision'])
    updated = copy.deepcopy(metadata)
    updated['maxNormalizedEmbeddings'] = asset
    with output.open('xb') as stream:
        stream.write(encoded(updated))
    print(f'Wrote {output}: {output.stat().st_size / 1024**2:.2f} MiB; {len(records)} records, {len(asset["profiles"])} profiles; both metrics verified')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('results', 'package', 'metadata', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    export(args.results, args.package, args.metadata, args.output)
