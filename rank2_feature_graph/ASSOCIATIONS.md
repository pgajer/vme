# Enrollment associations

Choose **ZAPPS & PreSSMat → Associations → Enrollment associations**.
The association workspace displays the frozen enrollment reference at 60%, 70%,
80% or 90% coverage, with the corresponding saved edges. It is distinct from the
all-visit exploration graph. Return to exploration restores that existing view;
association selection, cohort and coverage never change its sample membership,
coordinates or filters.

Each participant contributes one approved enrollment specimen. Outcomes are
original study sPTB case designations, not the narrower adjudicated clinical
endpoint. These selected case–control samples do not estimate population sPTB
prevalence or individual risk. Cohorts are displayed separately, never pooled.

## Reading results

- **Exact matched odds ratios:** state versus all other states in the original
  informative matched sets. The population and case counts are shown for each cohort. Expected cases sum the state-membership fraction within each
  retained one-case matched set. The table shows 95% exact confidence intervals,
  informative-set counts, raw p and saved Holm/BY adjustments across both cohorts
  at that coverage (twice the number of reference states). These adjustments do not cover
  searching across resolutions, outcomes or analysis branches.
- **Observed / expected cases:** all approved women in each cohort. Expected = state women × cohort case
  fraction. This is descriptive, with no hypothesis test or confidence interval.

The graph uses the matching saved edges and a schematic circular layout, not
MDS coordinates. Both cohorts use the same log-ratio color scale: blue below 1,
red above 1, neutral at 1, saturated at 1/8 and 8. Gray means unavailable.
Edges have fixed widths; vertex area grows with degree. No edge is hidden by
p-value or state size. Click an edge or a table state name for its cohort
comparison. Empty cohort states remain visible. Counts always use the named
analysis population, even while the table is filtered. State pair names do not
imply those taxa dominate every absorbed sample.

Infinite estimates and confidence limits remain explicit. Forest-plot arrows
mark limits outside its 1/64–64 scale; triangles mark estimates outside that
scale. Table and CSV retain the actual zero/infinite values. Failed ordinary
regression fits are excluded. The ongoing limitations of adjusted 60% validation
are stated; only saved unadjusted exact tests and descriptive counts are loaded.

## Distribution

Software sources contain no study-result payload. The private development build
accepts `--association-supplement PATH` (default `enrollment_associations.json`).
It validates and packages aggregate results into immutable assets loaded with
the owning dataset. No fitting runs during build, update or interaction.

Shared installations can use **Load association supplement…** with the supplied
JSON. This loads results for the current browser session; it does not upload the
file to a service. For persistent installation, attach the supplement to a copy
of the installation's metadata (preserving every existing supplement):

```sh
python3 scripts/association_supplement.py \
  --supplement /path/to/enrollment_associations.json \
  --metadata /path/to/current-metadata.json \
  --output /path/to/metadata-with-associations.json
python3 scripts/portable.py update --metadata /path/to/metadata-with-associations.json
```

The helper refuses to overwrite an existing output. Dataset and analysis assets
remain separately distributed under their own access and reuse terms.

## Preparation and verification

`prepare_enrollment_associations.py` reads the four saved
`zapps_pressmat_sptb{60,70,80,90}_2026-10-26-v1` releases beneath `--results` and
writes a new file with `--output`. It never fits models or changes assignments.
It checks participant uniqueness, eligibility, consistent population across
coverage, graph/partition identities, edge membership, case counts, matched-set
structure, expected counts and informative-set counts against the source ledgers.
It independently evaluates the saved exact p-values, estimates and 95% limits
using matched-set Poisson-binomial distributions.
60% uses its separate all/matched rows and its 14-test conditional family, not
the broader 28-test family that also includes ordinary Fisher comparisons.

Only aggregates, reference topology, release names and source hashes are
exported. No participant IDs, specimen IDs, outcomes per participant or covariates
are included. The importer fails on mismatch rather than substituting current
VME assignments. Source identities remain inspectable in the workspace.

Run on demand, outside the update command:

```sh
node rank2_feature_graph/test_associations.mjs
python3 -m unittest discover -s rank2_feature_graph -p test_enrollment_associations.py
```

The JavaScript tests use synthetic results and optionally validate the local
supplement. The private Python test reconciles the frozen releases and exercises
rejection of changed counts and identities; it skips if those sources are absent.
Browser checks must cover all coverage choices, cohort comparison, graph/table
selection, descriptive versus matched denominators, unbounded and unavailable
results, return to exploration, and switching to an unaffected dataset.
