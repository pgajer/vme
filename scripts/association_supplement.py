#!/usr/bin/env python3
"""Validate and attach separately distributed, aggregate enrollment results."""
import argparse
import copy
import json
import math
from pathlib import Path

DATASET = 'zapps-pressmat-v4'
COHORTS = ('ZAPPS', 'PreSSMat')
COVERAGES = ('60', '70', '80', '90')


def validate(bank):
    def require(ok, message):
        if not ok:
            raise ValueError('Association supplement: ' + message)
    require(bank.get('version') == 1 and bank.get('dataset') == DATASET, 'unsupported dataset/schema')
    require(bank.get('outcome') == 'original-study-sptb' and bank.get('window') == 'approved-enrollment', 'outcome/window differs')
    require(bank.get('annotation') == 'enrollment-merged-rank2', 'reference type differs')
    require(set(bank['coverages']) == set(COVERAGES), 'expected 60, 70, 80 and 90% results')
    for q in COVERAGES:
        release = bank['coverages'][q]
        count = len(release['edges'])
        require(0 < count <= 10000, 'invalid reference edge count')
        require(len({e['id'] for e in release['edges']}) == count, 'duplicate edge identity')
        for key in ['graphId', 'partitionId', 'membershipSha256']:
            require(len(release[key]) == 64 and all(c in '0123456789abcdef' for c in release[key]), 'missing reference identity')
        require(release['testFamilySize'] == 2 * count, 'incorrect exact-test family')
        require(release['coverage'] == int(q) and int(q) <= release['actualCoverage'] <= 100, 'coverage differs')
        require(len({n['id'] for n in release['nodes']}) == len(release['nodes']), 'duplicate node')
        nodes = {n['id'] for n in release['nodes']}
        require(set(release['cohorts']) == set(COHORTS), 'cohort identity differs')
        require(release['cohorts'] == bank['coverages']['60']['cohorts'], 'population changes across coverage')
        for cohort in COHORTS:
            population = release['cohorts'][cohort]
            total, cases, matched, matched_cases = (population[k] for k in ['n','cases','matchedN','matchedCases'])
            require(all(isinstance(v,int) for v in population.values()) and 0 < total and 0 <= cases <= total and 0 <= matched_cases <= matched <= total and matched_cases <= cases, 'invalid cohort population')
            for mode, n in [('all', total), ('matched', matched)]:
                rows = [e['results'][cohort][mode] for e in release['edges']]
                require(sum(r['n'] for r in rows) == n and sum(r['cases'] for r in rows) == (cases if mode == 'all' else matched_cases), 'counts do not reconcile')
                require(abs(sum(r['expected'] for r in rows) - (cases if mode == 'all' else matched_cases)) < 1e-6, 'expectations do not reconcile')
        for edge in release['edges']:
            require(edge['from'] in nodes and edge['to'] in nodes and edge['from'] != edge['to'], 'unknown endpoint')
        if 'vertices' in release:
            vertices = release['vertices']
            require(len(vertices) == len(nodes) and {v['id'] for v in vertices} == nodes, 'vertex identities differ')
            require(release['vertexTestFamilySize'] == (bank['vertexMultiplicity']['familySize'] if bank.get('vertexMultiplicity') else 2*len(nodes)), 'incorrect vertex test family')
            for vertex in vertices:
                incident = [e for e in release['edges'] if vertex['id'] in (e['from'], e['to'])]
                require(len(vertex['incidentEdges']) == len(incident) and set(vertex['incidentEdges']) == {e['id'] for e in incident}, 'incident states differ')
                for cohort in COHORTS:
                    for mode in ['all', 'matched']:
                        # Enrollment states partition participants; their incident union is disjoint.
                        for key in ['n', 'cases', 'expected']:
                            require(math.isclose(vertex['results'][cohort][mode][key], sum(e['results'][cohort][mode][key] for e in incident), abs_tol=1e-6), 'vertex union counts differ')
        for edge in release['edges'] + release.get('vertices', []):
            for cohort in COHORTS:
                result = edge['results'][cohort]
                for mode in ['all', 'matched']:
                    r = result[mode]
                    require(isinstance(r['n'], int) and isinstance(r['cases'], int) and 0 <= r['cases'] <= r['n'], 'invalid counts')
                    require(math.isfinite(r['expected']) and 0 <= r['expected'] <= r['n'] + 1e-8, 'invalid expected count')
                exact = result['exact']
                require(isinstance(exact['sets'], int) and exact['sets'] >= 0, 'invalid informative set count')
                for field in ['p', 'holm', 'by']:
                    v = exact[field]
                    require(v is None or (isinstance(v, (int,float)) and math.isfinite(v) and 0 <= v <= 1), 'invalid p-value')
                for field in ['logOR', 'low', 'high']:
                    v = exact[field]
                    require(v is None or v in ['-Infinity', 'Infinity'] or (isinstance(v, (int,float)) and math.isfinite(v)), 'invalid log odds')
                if exact['supported']:
                    require(exact['sets'] > 0 and all(exact[k] is not None for k in ['p','holm','by','logOR','low','high']), 'supported test is incomplete')
    if bank.get('vertexMultiplicity'):
        family = bank['vertexMultiplicity']
        require(family.get('version') == 1 and family.get('scope') == 'all-coverages-unique-vertex-cohort'
                and family.get('coverages') == [60,70,80,90], 'unknown vertex adjustment scope')
        groups = {}
        raw = 0
        for q in COVERAGES:
            require('vertices' in bank['coverages'][q], 'joint family requires all vertices')
            for v in bank['coverages'][q]['vertices']:
                for c in COHORTS:
                    x = v['results'][c]['exact']
                    key = x.get('analysisId', '')
                    require(len(key) == 64 and all(t in '0123456789abcdef' for t in key), 'missing analysis identity')
                    groups.setdefault(key, []).append((int(q), v['id'], v['name'], c, x))
                    raw += 1
        m = len(groups)
        require(family['familySize'] == m and family['displayedTests'] == raw
                and family['duplicateTests'] == raw-m, 'joint vertex family size differs')
        require(family['unavailableTests'] == sum(not g[0][4]['supported'] for g in groups.values()), 'unavailable test count differs')
        for entries in groups.values():
            first = entries[0]
            qs = sorted(e[0] for e in entries)
            require(len(set(qs)) == len(qs), 'duplicate analysis within coverage')
            for e in entries:
                require(e[1:4] == first[1:4] and e[4] == first[4], 'identical analyses disagree')
                require(e[4].get('identicalCoverages') == qs, 'identical coverage labels differ')
        # Independently validate both corrections on unique tests, including unavailable p=1.
        tests = sorted((e[0][4] for e in groups.values()), key=lambda x:x['p'] if x['supported'] else 1)
        h = sum(1/i for i in range(1,m+1))
        holm, by = 0., 1.
        for i, x in enumerate(tests):
            holm = min(1., max(holm, (m-i)*(x['p'] if x['supported'] else 1)))
            if x['supported']:
                require(math.isclose(x['holm'], holm, abs_tol=1e-12), 'joint Holm value differs')
        for i in range(m-1,-1,-1):
            x = tests[i]
            by = min(by, (x['p'] if x['supported'] else 1)*m*h/(i+1), 1.)
            if x['supported']:
                require(math.isclose(x['by'], by, abs_tol=1e-12), 'joint BY value differs')
    return bank


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--supplement', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    bank = validate(json.loads(args.supplement.read_text()))
    metadata = json.loads(args.metadata.read_text())
    if DATASET not in metadata['datasetRevisions']:
        raise ValueError('Metadata does not include ZAPPS & PreSSMat')
    metadata = copy.deepcopy(metadata)
    metadata.setdefault('associationResults', {})[DATASET] = bank
    with args.output.open('x') as f:
        json.dump(metadata, f, separators=(',', ':'), allow_nan=False)
    print(args.output)


if __name__ == '__main__':
    main()
