# VALENCIA2 coloring across datasets

VALENCIA2 CSTs and subCSTs describe saved classifications of full sample
compositions. They are independent of the selected embedding, normalization,
2-CST coverage and graph selection. Switching Color by changes only colors.
The common palette is specified in [COLOR_SPECIFICATION.md](../COLOR_SPECIFICATION.md).

| Dataset | Annotation source/status |
|---|---|
| comb-V3V4-tx | Existing validated full-composition calls, restricted with the dataset population |
| comb-V4-tx | Existing validated full-composition calls |
| ZAPPS & PreSSMat | Exact subset of comb-V4 calls: all 4,941 records checked by ID, original profile index and identical full composition |
| LSVF | New full-composition calls from the accepted November 11, 2024 cleaned count table; 1,991 specimens |
| HMP+U01 40-participant panel and full legacy HMP/U01 | Unavailable pending a verified mapping of legacy taxa to the VALENCIA2 reference |
| PAPCLEAR provisional | Unavailable pending a verified mapping of legacy taxa to the VALENCIA2 reference |
| Optional Li/Lc neighborhoods | Existing calls from each neighborhood's own historical parent population |

Unavailable choices remain visible and disabled. Hover over Color by for the
reason. Historical CST labels are preserved separately and are never relabeled
as VALENCIA2.

## Reference and LSVF validation

The reference is `VALENCIA2_CST_centroids_19Aug2024.csv`, SHA-256
`e6045ccd7350eb45a5621eb35feff2e61ffcc00fcc3fb9299ec15b07cdac4c64`.
Calls use the archived VALENCIA implementation at commit
`f5462fb96af5660a6a5794b6b3211721d32c64a2` and its Yue–Clayton similarity.
Sample-only taxa are retained with zero reference abundance; reference-only
taxa have zero sample abundance. Matching does not renormalize the sample.

For LSVF, each source count profile was checked against its frozen VME full
composition. The original taxon labels were recovered by the documented
underscore-to-space display transformation. Matching uses exact names and the
same four explicit punctuation aliases used for the combined datasets; it
makes no genus-to-species or synonym inference. Every mapped name is recorded
in the supplement. Mean matched abundance is 99.9169%; the minimum is 77.9207%.
All 25,883 sample-to-centroid similarities were compared against the unchanged
archived scalar classifier. The maximum difference was 1.33e-15 and all winners
agreed. Historical source CSTs are retained separately.

LSVF's accepted-source cautions remain: its exact taxonomy/model version and
processing history have not been recovered. These new calls classify the
supplied named abundance profiles; they do not establish sequencing taxonomy
accuracy or remove any scientific hold. Similarly, sharing an older sample ID
with a modern combined dataset would not establish that the abundance profile
or taxonomy was the same.

## Separate distribution

A metadata supplement may include a `valencia2` map keyed by dataset ID.
Each annotation asset binds its labels to the dataset revision, profile order,
record-to-profile mapping, and a digest of the full feature/composition data.
It includes reference identity, all centroid scores, matched abundance,
historical labels, and provenance. The installer validates these before making
any new app directory and refuses to replace existing annotations.

Install a supplied metadata supplement using the usual update command:

```sh
python3 ~/vme-source/scripts/portable.py update --output ~/vme --metadata /path/to/supplied-metadata.json
```

The updater remembers that metadata path for subsequent updates. A Git update
alone cannot supply scientific annotations. Supplements and datasets are
separately distributed under their own terms and are not part of the MIT
software license. A supplement must match the recipient's data package; do not
edit checksums to bypass that requirement.

Focused checks, run on demand from the clone:

```sh
python3 rank2_feature_graph/test_valencia_supplement.py
node rank2_feature_graph/test_sample_coloring.mjs
```

These test rejection of incompatible identities and invalid diagnostics, palette
selection, unavailable states and preservation of coordinates/selection when
colors change. They do not replace the upstream numerical comparison or browser
inspection. Neither runs automatically during an update.
