#!/usr/bin/env python3
"""Build current VME source against a separately shared, immutable Mac data package."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import fcntl
import socket
import subprocess
import tempfile
from contextlib import contextmanager

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / 'rank2_feature_graph'
sys.path.insert(0, str(HERE))
from viewer_source import assemble_viewer
from taxon_palette import load_palette
from resource_pages import source_digest, page as resource_page
from policy_document import policy_html

PATTERN = r'<script id="vme-http-manifest" type="application/json">(.*?)</script>'


def encoded(value):
    return json.dumps(value, separators=(',', ':'), allow_nan=False).encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_manifest(path):
    match = re.search(PATTERN, path.read_text(), re.S)
    if not match:
        raise ValueError('No VME data manifest: ' + str(path))
    manifest = json.loads(match[1])
    if manifest.get('version') != 1:
        raise ValueError('Unsupported data manifest version')
    return manifest


def descriptors(value):
    if isinstance(value, dict):
        if 'url' in value and 'sha256' in value and 'bytes' in value:
            yield value
        for part in value.values():
            yield from descriptors(part)
    elif isinstance(value, list):
        for part in value:
            yield from descriptors(part)


def asset_path(web, desc):
    url = desc['url']
    if not re.fullmatch(r'/vme-assets/[a-f0-9]{64}\.(json|js)', url):
        raise ValueError('Invalid asset path: ' + url)
    if Path(url).stem != desc['sha256']:
        raise ValueError('Asset filename/hash mismatch')
    path = (web / url.lstrip('/')).resolve()
    if web.resolve() not in path.parents:
        raise ValueError('Asset leaves data package')
    return path


def checked_bytes(web, desc):
    raw = asset_path(web, desc).read_bytes()
    if len(raw) != desc['bytes'] or sha(raw) != desc['sha256']:
        raise ValueError('Data asset checksum mismatch: ' + desc['url'])
    return raw


def package_manifest(package):
    if not (package / 'PACKAGE_MANIFEST.json').is_file():
        raise ValueError('Select the complete unzipped VME package, not its web subfolder')
    return read_manifest(package / 'web/index.html')


def package_views(web, manifest):
    result = {}
    for desc in manifest.get('neighborhoods', {}).get('parts', []):
        part = json.loads(checked_bytes(web, desc))
        for hood in part.get('familyNeighborhoods', {}).get('neighborhoods', []):
            for view in hood['views']:
                result[view['id']] = (hood, view)
    return result


def export_metadata(package, output):
    """Author-only: export diagnostics/summaries, never observations or refits."""
    old = package_manifest(package)
    current = read_manifest(ROOT / 'index.http.html')
    app = checked_bytes(ROOT, current['application']).decode()
    match = re.search(r'const legendAbundanceTotals=(?:BUNDLE_PACK.legendAbundanceTotals\|\|)?', app)
    if not match:
        raise ValueError('Build the current viewer before exporting metadata')
    totals, _ = json.JSONDecoder().raw_decode(app[match.end():])
    revisions = {key: value['dataset']['revision'] for key, value in old['datasets'].items()}
    for key, revision in revisions.items():
        if current['datasets'][key]['dataset']['revision'] != revision or totals[key]['datasetRevision'] != revision:
            raise ValueError('Dataset changed; export a new data package: ' + key)
    old_views = package_views(package / 'web', old)
    current_views = package_views(ROOT, current)
    diagnostics = {}
    for key, (hood, view) in old_views.items():
        new_hood, new_view = current_views[key]
        if (hood['profileIds'] != new_hood['profileIds'] or
                view['coordinateSha256'] != new_view['coordinateSha256'] or
                view['alignment'] != new_view['alignment']):
            raise ValueError('Embedding changed; a new data package is required: ' + key)
        if new_view.get('distanceEvaluation'):
            diagnostics[key] = new_view['distanceEvaluation']
    metadata = dict(version=1, baseManifestSha256=sha(encoded(old)), datasetRevisions=revisions,
                    legendAbundanceTotals={k: totals[k] for k in revisions},
                    embeddingStressDiagnostics=diagnostics)
    with output.open('xb') as stream:
        stream.write(encoded(metadata))
    print(f'Metadata: {output} ({output.stat().st_size / 1024:.1f} KiB); SHA256 {sha(output.read_bytes())}')


def validate_metadata(metadata, manifest, views):
    if metadata.get('version') != 1 or metadata.get('baseManifestSha256') != sha(encoded(manifest)):
        raise ValueError('Metadata belongs to a different data package')
    revisions = {k: v['dataset']['revision'] for k, v in manifest['datasets'].items()}
    if metadata['datasetRevisions'] != revisions:
        raise ValueError('Metadata dataset revisions differ')
    for key, revision in revisions.items():
        if metadata['legendAbundanceTotals'][key]['datasetRevision'] != revision:
            raise ValueError('Legend metadata revision differs')
    for key, value in metadata['embeddingStressDiagnostics'].items():
        hood, view = views[key]
        if (value['fingerprint']['coordinateSha256'] != view['coordinateSha256'] or
                value['fingerprint']['scale'] != view['alignment']['scale'] or
                value['profiles'] != hood['size']):
            raise ValueError('Diagnostic coordinates differ: ' + key)


def copy_file(source, destination):
    source, destination = Path(source), Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Immutable data can share disk blocks; generated code always gets new files.
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def prepare(package, metadata_path, output, announce=True):
    if output.exists():
        raise ValueError('Choose a new output folder; existing copies are never overwritten')
    original = package_manifest(package)
    web = package / 'web'
    metadata = json.loads(metadata_path.read_text())
    validate_metadata(metadata, original, package_views(web, original))
    manifest = copy.deepcopy(original)
    manifest['seed'].update({k: metadata[k] for k in ('legendAbundanceTotals', 'embeddingStressDiagnostics')})
    if metadata.get('maxNormalizedEmbeddings'):
        from max_normalized_supplement import population, validate
        validate(metadata['maxNormalizedEmbeddings'], population(package, original),
                 original['datasets']['comb-V3V4-tx']['dataset']['revision'])
        manifest['seed']['maxNormalizedEmbeddings'] = metadata['maxNormalizedEmbeddings']
    # Validate all scientific asset bytes before creating an output directory.
    retained = copy.deepcopy(original)
    for key in ('application', 'validator'):
        retained.pop(key, None)
    assets = {d['url']: d for d in descriptors(retained)}
    for desc in assets.values():
        checked_bytes(web, desc)
    sums = {}
    for line in (package / 'SHA256SUMS.txt').read_text().splitlines():
        digest, name = line.split('  ', 1)
        sums[name] = digest
    if sha((package / 'vme-server').read_bytes()) != sums.get('vme-server'):
        raise ValueError('Packaged native server checksum differs')
    for name in ('mutual-overlap', 'reports'):
        for path in (web / name).rglob('*'):
            if path.is_file():
                if web.resolve() not in path.resolve().parents:
                    raise ValueError('Resource leaves data package')
                if sha(path.read_bytes()) != sums.get(path.relative_to(package).as_posix()):
                    raise ValueError('Resource checksum differs: ' + str(path))
    page = assemble_viewer(HERE, pack='const BUNDLE_PACK={};', plotly='', palette=load_palette(HERE),
                           legend_abundance={}, overlap_available=(web / 'mutual-overlap/index.html').is_file())
    scripts = list(re.finditer(r'<script>(.*?)</script>', page, re.S))
    application = scripts[-1][1]
    application = application[application.index('const VMRC_TAXON_PALETTE='):]
    # The supporting V4 bundle remains available to neighborhoods only.
    old = 'const options=[...catalogue.values()].map'
    if application.count(old) != 1:
        raise ValueError('Review portable dataset selector integration')
    application = application.replace(old, 'const options=[...catalogue.values()].filter(b=>!BUNDLE_PACK.distributionDatasets||BUNDLE_PACK.distributionDatasets.includes(b.dataset.id)).map')
    loader = (HERE / 'asset_loader.js').read_text()
    old = 'Object.values(manifest.datasets).map'
    if loader.count(old) != 1:
        raise ValueError('Review portable loader integration')
    loader = loader.replace(old, 'Object.values(manifest.datasets).filter(x=>!manifest.seed.distributionDatasets||manifest.seed.distributionDatasets.includes(x.dataset.id)).map')
    output.mkdir(parents=True)
    outweb = output / 'web'
    for url, desc in assets.items():
        copy_file(asset_path(web, desc), outweb / url.lstrip('/'))
    def publish(raw, suffix='js'):
        digest = sha(raw)
        url = '/vme-assets/' + digest + '.' + suffix
        path = outweb / url.lstrip('/')
        if not path.exists():
            path.write_bytes(raw)
        return dict(url=url, bytes=len(raw), sha256=digest)
    manifest['application'] = publish(('VME_ASSETS.releaseControls();\n' + application).encode())
    manifest['validator'] = publish((HERE / 'bundle_format.js').read_bytes())
    loader_desc = publish(loader.encode())
    bootstrap = '<script id="vme-http-manifest" type="application/json">' + encoded(manifest).decode().replace('</', '<\\/') + '</script><script src="' + loader_desc['url'] + '"></script>'
    pieces = []; cursor = 0
    for i, match in enumerate(scripts):
        pieces.extend((page[cursor:match.start()], bootstrap if i == 1 else ''))
        cursor = match.end()
    pieces.append(page[cursor:])
    page = ''.join(pieces).replace('<body>', '<body><p id="vmeLoadStatus" role="status" aria-live="polite">Loading dataset…</p><button id="vmeLoadRetry" type="button" hidden>Retry loading</button>', 1)
    (outweb / 'index.html').write_text(page)
    for name in ('about.html', 'portable.html'):
        shutil.copy2(web / name, outweb / name)
    (outweb / 'QUALITY_PREVIEW_POLICY.md').write_bytes((HERE / 'QUALITY_PREVIEW_POLICY.md').read_bytes())
    (outweb / 'quality.html').write_text(resource_page('Quality preview rules', policy_html(HERE), 'index.html'))
    # Retain the data-package provenance, clearly separated from the new interface.
    about = outweb / 'about.html'
    about.write_text(about.read_text().replace('<main>', '<main><p><strong>Interface updated from GitHub source.</strong> Source fingerprint: ' + source_digest(HERE)[:12] + '. The dataset and original build provenance below describe the separately supplied data package.</p>', 1))
    for name in ('mutual-overlap', 'reports'):
        if (web / name).is_dir():
            shutil.copytree(web / name, outweb / name, copy_function=copy_file)
    shutil.copy2(package / 'vme-server', output / 'vme-server')
    instance = sha(encoded(dict(source=source_digest(HERE), metadata=sha(metadata_path.read_bytes()), package=sha(encoded(original)))))
    (outweb / 'vme-instance.txt').write_text(instance)
    launcher = (package / 'Start VME.command').read_text().replace('43817', '43818')
    launcher = launcher.replace('/vme-health', '/vme-instance.txt').replace('VME-portable-2026-10-23', instance)
    (output / 'Start VME.command').write_text(launcher)
    (output / 'Start VME.command').chmod(0o755)
    receipt = dict(sourceSha256=source_digest(HERE), baseManifestSha256=sha(encoded(original)),
                   metadataSha256=sha(metadata_path.read_bytes()), dataPackage=str(package),
                   metadataFile=str(metadata_path),
                   datasets=list(manifest['seed']['distributionDatasets']), application=manifest['application'],
                   diagnosticCount=len(metadata['embeddingStressDiagnostics']))
    (output / 'SOURCE_AND_DATA.json').write_text(json.dumps(receipt, indent=2) + '\n')
    (output / 'READ ME FIRST.txt').write_text('Double-click Start VME.command. Keep its Terminal open.\nThis copy uses current GitHub interface source with your separately supplied data.\nNo fitting or data changes occurred. Port: 43818.\nFor another update: stop this viewer, then in ~/vme-source run git pull --ff-only followed by python3 scripts/portable.py update.\nThe original data package stays unchanged. SOURCE_AND_DATA.json records both identities.\n')
    if announce:
        print('Ready: ' + str(output / 'Start VME.command'))


@contextmanager
def update_lock(output):
    """Serialize updates without leaving a stale lock after a process exits."""
    with (output.parent / ('.' + output.name + '-update.lock')).open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another update is running for ' + str(output)) from None
        yield


@contextmanager
def stopped_viewer(output):
    """Reserve the launch port and reject this app running on another port."""
    processes = subprocess.check_output(['/bin/ps', '-ww', '-axo', 'command='], text=True)
    for line in processes.splitlines():
        arguments = line.partition('vme-server ')[2].rsplit(' ', 1)
        if (len(arguments) == 2 and arguments[1].isdigit()
                and Path(arguments[0]).resolve() == (output / 'web').resolve()):
            raise ValueError('Stop the viewer with Control-C in its Terminal before updating')
    port = int(os.environ.get('VME_PORT', '43818'))
    if not 1024 <= port <= 65535:
        raise ValueError('VME_PORT must be between 1024 and 65535')
    with socket.socket() as reservation:
        try:
            reservation.bind(('127.0.0.1', port))
        except OSError:
            raise ValueError(f'Port {port} is in use. Stop the viewer before updating') from None
        yield


def validate_prepared(output):
    """Re-read the finished candidate, including newly generated script bytes."""
    web = output / 'web'
    manifest = read_manifest(web / 'index.html')
    for desc in descriptors(manifest):
        checked_bytes(web, desc)
    html = (web / 'index.html').read_text()
    loaders = re.findall(r'<script src="(/vme-assets/([a-f0-9]{64})\.js)"></script>', html)
    if not loaders:
        raise ValueError('Prepared viewer has no loader')
    for url, digest in loaders:
        raw = (web / url.lstrip('/')).read_bytes()
        checked_bytes(web, dict(url=url, sha256=digest, bytes=len(raw)))
    receipt = json.loads((output / 'SOURCE_AND_DATA.json').read_text())
    if receipt['application'] != manifest['application']:
        raise ValueError('Prepared application receipt differs')
    if not re.fullmatch('[a-f0-9]{64}', (web / 'vme-instance.txt').read_text()):
        raise ValueError('Prepared viewer identity is invalid')
    if not os.access(output / 'vme-server', os.X_OK):
        raise ValueError('Prepared native server is not executable')
    subprocess.run(['/bin/bash', '-n', str(output / 'Start VME.command')], check=True)


def recover_update(output, journal):
    """Recover a replacement interrupted between moving the old and new app."""
    if not journal.exists():
        return
    record = json.loads(journal.read_text())
    name = record['transaction']
    if Path(name).name != name or not name.startswith(output.name + '-update-'):
        raise ValueError('Invalid update recovery record: ' + str(journal))
    transaction = output.parent / name
    if transaction.is_symlink() or (transaction / 'previous').is_symlink():
        raise ValueError('Update recovery paths must not be symbolic links')
    previous = transaction / 'previous'
    if not output.exists() and record['hadPrevious']:
        if not previous.is_dir():
            raise ValueError('Previous app is missing; inspect ' + str(transaction))
        previous.rename(output)
        print('Recovered previous app: ' + str(output))
    journal.unlink()


def update(package=None, metadata_path=None, output=None):
    output = Path(output or Path.home() / 'vme').expanduser().absolute()
    if output.is_symlink():
        raise ValueError('The app folder must not be a symbolic link')
    output = output.resolve()
    # Reject the source checkout before creating any locks or staging folders.
    if output == ROOT or output in ROOT.parents or ROOT in output.parents:
        raise ValueError('Keep the source clone in ~/vme-source and the app in ~/vme')
    output.parent.mkdir(parents=True, exist_ok=True)
    with update_lock(output), stopped_viewer(output):
        journal = output.parent / ('.' + output.name + '-update.json')
        recover_update(output, journal)
        old_receipt = {}
        if output.exists():
            if (output / '.git').exists() or not (output / 'SOURCE_AND_DATA.json').is_file():
                raise ValueError('Existing output is not a prepared VME app; it will not be replaced')
            old_receipt = json.loads((output / 'SOURCE_AND_DATA.json').read_text())
            if not all((output / name).is_file() for name in ('vme-server', 'Start VME.command', 'web/index.html')):
                raise ValueError('Existing app is incomplete; inspect it before updating')
        package = Path(package or old_receipt.get('dataPackage') or
                       Path.home() / 'Downloads/VME-Mac-Meeting-2026-10-23').expanduser().resolve()
        metadata_path = Path(metadata_path or old_receipt.get('metadataFile') or
                             Path.home() / 'Downloads/VME-metadata-2026-10-24.json').expanduser().resolve()
        if (output == package or output in package.parents or package in output.parents
                or output == metadata_path or output in metadata_path.parents):
            raise ValueError('Keep the original data package and metadata outside the app folder')
        transaction = Path(tempfile.mkdtemp(prefix=output.name + '-update-', dir=output.parent))
        candidate, previous = transaction / 'candidate', transaction / 'previous'
        try:
            prepare(package, metadata_path, candidate, announce=False)
            validate_prepared(candidate)
            # Write recovery information before either directory is moved.
            with journal.open('x') as stream:
                json.dump(dict(transaction=transaction.name, hadPrevious=output.exists()), stream)
                stream.flush()
                os.fsync(stream.fileno())
            if output.exists():
                output.rename(previous)
            candidate.rename(output)
            journal.unlink()
        except BaseException:
            if previous.exists() and not output.exists():
                previous.rename(output)
                if journal.exists():
                    journal.unlink()
            print('Update did not finish. Diagnostic files retained at: ' + str(transaction), file=sys.stderr)
            raise
        print('Ready: ' + str(output / 'Start VME.command'))
        if previous.exists():
            print('Previous app retained at: ' + str(previous))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ('prepare', 'export-metadata'):
        item = sub.add_parser(command)
        item.add_argument('--package', type=Path, required=True)
        item.add_argument('--output', type=Path, required=True)
        if command == 'prepare':
            item.add_argument('--metadata', type=Path, required=True)
    item = sub.add_parser('update', help='Safely install or replace ~/vme using the current source checkout')
    item.add_argument('--package', type=Path, help='Original data package (remembered after setup)')
    item.add_argument('--metadata', type=Path, help='Metadata supplement (remembered after setup)')
    item.add_argument('--output', type=Path, default=Path.home() / 'vme')
    args = parser.parse_args()
    try:
        if args.command == 'update':
            update(args.package, args.metadata, args.output)
        elif args.command == 'prepare':
            prepare(args.package.resolve(), args.metadata.resolve(), args.output.resolve())
        else:
            export_metadata(args.package.resolve(), args.output.resolve())
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, 'VME setup: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
