# Trajectory quality preview and context tracks

Implemented 2026-10-16. Policy identifier: `flag-only-v2`.

<!-- UI-SUMMARY-START -->
## Quick guide

These are **inspection flags only**. They retain every record in the active
eligible population. A merged-group name need not describe the sample's dominant taxa.

- **Sample eligibility is separate:** comb-V3V4-tx excludes 82 explicitly labelled
  laboratory controls under `explicit-control-exclusion-v1`. Its 25,013 retained
  records include 548 with less than 90% VALENCIA2 reference-matched abundance.
  Low coverage and unresolved HMP identity/site evidence remain diagnostic flags,
  not automatic exclusions. Historical data and control QC records are preserved.

- **Read depth:** fewer than 1,000 analyzed reads is insufficient; 1,000–2,999 is limited; ≥3,000 passes the depth check only. Unknown depth is not zero.
- **Assignment support:** flag a merged group whose two named taxa are absent, a rank-3 bridge with fewer than 5 records on either side or tied winning cores, or a neighbor assignment with fewer than 5 voters, less than 70% winning support or a tied vote.
- **Endpoint and rank warnings:** a within-pair ≥95% square needs at least 100 named-pair reads; the original second/third taxon margin is flagged below 2 percentage points. These warnings never move or remove a point.
- **Tracks:** state size counts reference records in the displayed state, including a neighboring interval used by an endpoint square. Original assignment counts remain in the quality table and details. Read depth counts the reads used in the full composition. Hover for exact values; unknown/zero depth has a separate marker row.
- **Highlight flagged samples:** this optional checkbox draws orange rings around flagged trajectory observations. Hover for the reasons; assignments and positions stay unchanged.
- **Colors and limits:** orange means a flag; gray means incomplete checks. Blue means no flags in the assessed checks, not validated biological support. Independent-participant support and neighbor distance cutoffs remain unassessed or uncalibrated.
- **LSVF pH annotations:** two reviewed entries near 9.9 are “Unavailable—suspected code.” Their raw values and samples remain; numeric plots and scales exclude them. This separate metadata rule does not change state assignments or the scientific flags above.
- **LSVF questionnaire clarifications:** orange metadata outlines mark baseline new-partner derivation and zero-partner/condom-use questions awaiting clarification. These responses remain observed and included in counts. Track notes and the pending list in Annotation key and scope record unresolved definitions for future updates.

- **ZAPPS maternal annotations:** exact participant and INTERGROWTH-day matches only. Three inconsistent blood-pressure pairs are unavailable, with raw values retained. PreSSMat definitions and unresolved fields remain deferred. This separate annotation rule does not change trajectory quality flags.

Open the full policy below for dataset-specific read sources, thresholds,
missing-data handling, display rules and export behavior.
<!-- UI-SUMMARY-END -->

## Purpose and scientific boundary

The preview makes weak or unavailable evidence visible while retaining every
record and assignment in the active eligible population. Quality checks do not exclude records, leave them
unassigned, recompute groups, change a reference interval or density membership.
Separately, observations without a pair coordinate are not drawn in the trajectory
body: they remain selectable on a labeled top-margin row and in details/exports.
No line bridges their missing position. A flag is a reason
to inspect evidence, not a corrected state or a clinical interpretation.

Thresholds below are provisional inspection rules. Passing a read-depth check
alone does not establish assignment reliability. No sensitivity analysis or
biological calibration is claimed. A future screening/unassigned mode would
require a separately authorized scientific change and preserved original results.

## Separate laboratory-control eligibility policy

Eligibility policy `explicit-control-exclusion-v1` (20 October 2026) corrects
the comb-V3V4-tx population before state selection and display. It removes
41 JiVitA Zymo DNA controls, 40 JiVitA vaginal-DNA controls and one explicitly
labelled CONTRA Zymo positive control. Taxonomic plausibility, CST similarity
and reference coverage do not override their laboratory-control role.

The active population contains 25,013 library records and 24,960 distinct
compositions. The original 25,095-record release and the 82 control records
remain archived with count matrices, historical labels and VALENCIA2 diagnostics.
The 548 retained low-reference-coverage records are not declared invalid or
nonvaginal on that basis. The 180 HMP records lacking a resolved participant
link remain unresolved; no participant or specimen identity is imputed.

Reference catalogues, merged assignments and population-specific fits are
versioned for the corrected population. Identical-membership historical fits
retain their original provenance. Pure-state fits use the corrected 100% catalogue;
coverage and vertex-union views restrict corrected population coordinates and
are labelled as restrictions, not new subset fits. Li/Lc neighborhood membership
and coordinates are unchanged; their coloring uses the corrected reference.

The trajectory flag thresholds remain `flag-only-v2`. Their evidence is evaluated
against the active assignments, so a changed assignment can change a flag.
This is not a universal scientific-release approval. Future imports require
source-backed sample-role decisions; unrecognized control-like labels block
publication pending review. Absence of a suspicious label does not establish
biological origin. See `CONTROL_EXCLUSION.md` and the owning dataset's
`scripts/CONTROL_EXCLUSION_POLICY.md` for the admission gate and checks.

## Separate ZAPPS maternal-annotation policy

Annotation policy identifier: `zapps-maternal-v1-exact-day` (19 October 2026).
The scientific trajectory policy remains `flag-only-v2`; none of its thresholds,
assignments, positions or count denominators changes. Previous annotation files
and every original clinical value remain preserved.

Seven ZAPPS maternal rows use the original participant ID and exact integer
INTERGROWTH gestational day: weight (kg), systolic/diastolic pressure (mmHg), pulse
(beats/min), fundal height (cm), hemoglobin (g/dL), and vaginal bleeding response
(0 no, 1 yes). Source documentation and timing limitations are in
`ANNOTATION_TRACKS.md` and the owning project's maternal audit. No nearest-day
matching, imputation, carry-forward or fetal-field harmonization is allowed.
PreSSMat cells are unavailable pending cohort-specific documentation. Unmatched
or unrecorded values are missing, never zero/negative responses.

Systolic pressure must exceed the paired diastolic value to be plotted. In this
frozen supplement, three matched ZAPPS visits fail that consistency check; both
pressure values become null with status `invalid` and flag
`maternal_bp_pair_unresolved`. Hover/details explain the source discrepancy;
purple crossed diamonds replace measured marks. Raw source values, row numbers,
infant IDs, source hashes and exact matching day remain in CSV. This is a paired
consistency check, not a clinical screening threshold or inferred correction.
Neither pressure cell contributes to numeric scale limits. No other maternal
cell changes because of the pressure flag. All original timing flags remain.

Acceptance checks cover exact-day/cohort/identity validation, documented units,
explicit zero versus missing, concordant duplicate maternal values across infant
rows, all three numeric styles, participant-wide CSV provenance, unavailable
cohorts, and real PNG/SVG exports with baseline and optional retrospective rows.
Bleeding recall windows remain labelled: this pregnancy at enrollment and since
the last visit at follow-up; the extract does not identify the original form.
Positive responses are not dated episodes. Fetal and unresolved variables remain
deferred, including temperature with undocumented Celsius/Fahrenheit conversion.

## Separate PreSSMat enrollment annotation policy

PreSSMat enrollment extension `pressmat-baseline-v1` adds only documented height
(cm) and hemoglobin (g/dL) as baseline participant attributes. Each value is
repeated for reference, not treated as a measurement at every visit. Original
participant-workbook precision is retained; the merged hemoglobin table rounds
to whole g/dL. Both fields include source provenance and remain unavailable for
ZAPPS. This extension does not authorize repeated PreSSMat clinical measurements,
unresolved fields, or changes to the scientific trajectory policy.

## Separate LSVF clinical-annotation policy

Annotation policy identifier: `lsvf-annotations-v3-pending-clarifications`.
This is separate from the unchanged scientific `flag-only-v2` policy.
The two exact specimen/value cases reviewed in `LSVF.md` retain raw
`9.8999996`, but use a null numeric value, status `invalid` (not usable as a
measurement), and flag `lsvf_ph_suspected_code`. Their exact code meaning has
not been confirmed. They remain selectable as unavailable markers; hover,
details and CSV explain “Unavailable—suspected code.” They contribute neither
numeric marks nor pH scale limits, including in PNG/SVG. A subject with no
valid pH receives no numeric pH scale. No record, composition, state assignment,
trajectory coordinate or other metadata cell is changed. The original v1
annotation supplement remains preserved, as does v2; current builds use v3. This exact-case
rule is not a general pH cutoff for LSVF or other datasets. Acceptance checks
require equality of all other v1/v2 cells, retention of both raw values and
records, and exclusion from all three plot styles, scales and export values.

Version 3 adds interpretation flags without changing any v2 cell's raw value,
numeric/category value, observed/missing/invalid status, identity or time:

- `lsvf_baseline_newpartner_derivation`: 799 retained baseline yes/no responses
  have a blank detailed count; the summary's derivation awaits clarification.
  Both yes and no remain observed; yes responses still contribute to positive counts.
- `lsvf_zero_partners_condom_review`: 21 retained records report zero partners
  and condom use other than never. Both the partner-count and condom-use cells
  are flagged. Different recall windows or skip rules may explain them; neither
  response is excluded or declared erroneous.

Partner-count and condom-use track notes record the unresolved interpretation
scope. A six-item pending-clarifications list also retains the pH question and
issues in the unused Nugent category and alternate douching fields. Those unused
fields do not trigger new flags on current numeric Nugent or douching displays.
Orange annotation outlines and hover/detail explanations show the cell flags;
CSV preserves flag identifiers plus readable reasons and track interpretation notes.
PNG/SVG retain the outlines. This does not change the scientific quality preview.

Future clarification must cite the source-owner response or codebook, resolve
the relevant list item in a new versioned supplement, and compare every cell
against v3. Do not overwrite historical metadata or silently remove flags.

## Read-depth rules

Use the number of reads contributing to the displayed full composition, not
raw instrument output, a rounded percentage, the sum of only the named taxa,
or a guessed total from normalized values.

| Analyzed reads | Preview |
| --- | --- |
| Unknown | Incomplete checks; never substitute zero |
| 0–999 | Insufficient depth flag |
| 1,000–2,999 | Limited depth flag |
| ≥3,000 | Passes depth check only |

The separately labeled **within-pair ≥95% endpoint** also receives a low-pair-depth
flag when its named pair contains fewer than 100 reads. Unknown depth makes this
check unavailable. Pair reads are the verified analyzed total multiplied by the
unrounded frozen named-pair mass, rounded only to recover the integer count.
This check does not convert a within-pair endpoint into whole-sample dominance
and never suppresses or relocates a square.

## Assignment-support rules

Checks use the existing saved evidence at the current reference-core target.
They do not recompute neighbors, votes, bridges or ties.

| Scope | Flag / unavailable check |
| --- | --- |
| Original pair, when at least two taxa are positive | Flag if second-minus-third whole-sample abundance is <2 percentage points |
| All merged assignments | Flag if both named taxa have zero observed abundance |
| Rank-3 bridge | Flag if either source or core intersection has <5 records |
| Rank-3 bridge | Flag if there is more than one distinct winning core; repeated appearances of the same core are not a tie |
| Nearest-neighbor fallback | Flag if <5 eligible voters, winning fraction <70%, or >1 tied winning group |
| Missing route, bridge counts or vote evidence | Explicit incomplete check; do not invent evidence |
| Bridge or fallback independent-participant support | Not assessed; record counts are not independent-subject counts |
| Fallback distance support | Not calibrated; saved nearest winning distance/radius remain visible as evidence |

“Flagged” means one or more checks raised a flag. “Incomplete checks” means
no flag was raised but required evidence or calibration is unavailable.
“No flags in assessed checks” does not mean that biological support has been
validated. Flags and unavailable checks are both listed when both occur.
The original pair and assigned merged group remain separately identified.
Pure mode evaluates the original pair and does not apply merged-route rules.

## Read sources and validation

Read-depth metadata is a separate display supplement, `qualityReadDepths`, keyed
by dataset identifier, exact dataset revision and record identifier. Frozen
scientific bundles and participant supplements remain byte-for-byte untouched.
The builder authenticates source checksums, requires unique record matches and
complete coverage, and checks the exact feature dictionary and compositions.

| Dataset | Analyzed depth and provenance |
| --- | --- |
| ZAPPS + PreSSMat / comb-V4-tx | `canonical_v4_reads` in the checksum-verified library mapping. Exact profile mapping and integer counts against frozen full compositions are checked. `source_reads` is also reported, but differences are expected across processing stages and are not flagged as discrepancies. |
| UMB HMP | Sum of the exact released count columns in the source named by the pinned input manifest; compare every normalized feature with the frozen composition. `16s_total_reads` is retained separately. |
| LSVF | Sum of the exact source-order released count columns. The producer's documented underscore-to-space label conversion is verified. The metadata `read_count` differs from the count-column sum for 1,861 of 1,991 records: use the count-column sum, retain both values, and flag their disagreement. |
| HMP/U01 | Sum of released taxon columns in the checksum-verified clean timeline linked by each participant record; verify the full normalized composition. Retain `reads16s` separately. |

The two HMP count-block adapters retain the frozen structural-zero interpretation
of missing count cells. This is not a general permission to replace missing
measurements with zero. Count values must be finite, nonnegative integers within
JavaScript's exact integer range. A known source with a wrong checksum, duplicate
record mapping, changed feature order or different composition stops the build.
A missing local source produces explicit unknown read depths; it does not make
an otherwise portable release disappear. Unsupported new datasets also show
unknown depth until a verified adapter is supplied.

The panel and selected-observation details show the depth definition; full
source path and SHA256 are available in selected details and CSV. The build does
not acquire data. A source-only clone still needs separately provisioned assets.

## Two tracks above the trajectory

1. **State size · records** counts reference records in the displayed state.
   For an endpoint square placed on a compatible neighboring pair interval,
   use that interval's original-pair or merged-group membership count. For an
   isolated ≥95% single-taxon row, count reference records meeting that rule.
   This is a display annotation; it never reassigns the observation. HMP, LSVF
   and HMP/U01 use their full released population; V4 uses the ZAPPS + PreSSMat
   participant supplement. Counts are records, not unique participants or
   distinct profiles. A visit with no drawable state has no state-size point.
2. **Analyzed reads · log** shows each observation's verified analyzed depth on a
   logarithmic count axis. Dotted guides mark 1,000 and 3,000 reads. Unknown depth
   uses × and genuine zero depth uses an open diamond on a separate labeled rail,
   outside the numerical log axis. Neither is plotted as an invented positive count.

Both tracks share the trajectory's existing time/order axis, with no connecting
lines or implied interpolated values. Unordered observations remain in the
preview table, details and CSV; they are not assigned an invented time position.
Track markers use orange for any flag, gray for incomplete checks without flags,
and blue for no flags in assessed checks. Selection has a larger outlined marker.
Hover reports the displayed state/count and the underlying assignment/count
separately. Clicking a mark selects the same visit as the visit selector.

For AYAC02, V18/V19 show the Li–Lc reference-state count when their squares are
placed on that interval; their underlying 83-record Lc + genus Lactobacillus
assignment stays unchanged in the quality table, details and CSV. V17 retains
its saved 64-record merged assignment and all quality flags (two reads, zero
assigned-pair mass, three eligible voters, one winning vote and three tied
groups), but has no drawable pair coordinate. It appears on **Not drawn · no
pair position** in the top margin and in the read-depth track, not as a dashed
interval or a cross on an assigned-state row. Its gap is never connected across.
This omission is based on coordinate availability, not a new quality threshold.

The right-hand annotations report each component's maximum **whole-sample**
relative abundance among reference records assigned to the displayed state.
These are state-specific annotations, not a common continuous percentage scale
and not maxima after restricting/normalizing to the named pair. The displayed
interval still uses its original conditional pair-coordinate bounds.

Version history: `flag-only-v1` annotated the underlying assigned pair even when
an endpoint square was displayed elsewhere. `flag-only-v2` annotates the displayed
state and moves unavailable pair positions to the margin. Quality thresholds,
flags, scientific assignments and reference populations are unchanged.

## Controls, export and saved views

The **Show state-size track** and **Show read-depth track** checkboxes in
**Trajectory options** independently control the tracks in normal and maximized
trajectory panels. Both default to on. Choices persist in browser preferences
across reloads and are included in named views; older preferences/views without
these fields show both tracks. Hidden tracks reclaim their vertical space,
including read guides and the unknown/zero rail. Toggling preserves the trajectory
scale and ranges as well as both 3D cameras. The collapsed **Quality preview**
remains available regardless of track visibility. The preview table includes all
participant records.
Track navigation shares the existing selection path. Neither tracks nor checks
write to the sample or graph 3D camera; rotation, zoom and pan are retained.
The horizontal ranges of all tracks move together. Existing trajectory defaults
remain merged groups where available, density off, whole-sample ≥95% on and
within-pair endpoint display unchanged.

**Highlight flagged samples** is a separate checkbox in Trajectory options,
available in normal and maximized layouts. It defaults to off and is remembered
across reloads and in named views; older views without the setting use off.
When enabled, orange rings surround exactly the ordered observations with at
least one quality flag. Their original marker symbols, abundance fill, coordinates
and selection remain intact. Hovering a ring or its observation shows all flag
reasons first; clicking still selects that visit. Unordered flagged observations
receive an orange outline on their existing selection buttons, with reasons in
the tooltip; no artificial time position is created. Incomplete checks alone do
not create a ring. Context-track colors and the quality preview remain available
whether this checkbox is on or off. Highlighting does not change assignments,
reference counts, density membership, CSV values, axis ranges or 3D cameras.
Image exports include the rings when enabled. The highlight checkbox itself changes neither thresholds nor policy version.

PNG/SVG exports include only the currently visible tracks, their threshold guides
and interpretation. Hiding tracks does not remove quality information from CSV.
Trajectory CSV retains every existing column and adds policy/version, status,
flag codes, unassessed checks, reference-state record count, analyzed and reported
read counts, named-pair reads, assignment route/evidence, source path and SHA256.
Empty numeric fields mean unavailable, not zero. `reference_state_records` retains
the underlying assignment count; `displayed_reference_state_records` reports
the top-track count, and `drawn_in_trajectory` distinguishes margin-only records.

Named views continue to save the participant, mode, core target, selected visit,
trajectory ranges, endpoint settings, both track visibility settings and both 3D
cameras. Quality is always
flag-only and recomputed from the installed verified metadata when restoring a
view; raw read sources, tables and computed flags are not copied into named-view
JSON. Older named views remain valid. A second computer without the read source
can show unknown depth; a named view is not an archival scientific data package.

## Acceptance checks and maintenance

- `test_quality_data.py`: integer/missing counts, composition mismatch, source
  tampering, duplicate IDs, absent sources, immutable real releases and known
  AYAC02 read counts; LSVF discrepancies remain explicit.
- `test_trajectory_quality.mjs`: boundaries 999/1,000/2,999/3,000 and 99/100 pair
  reads; bridge/vote thresholds and ties; unknown versus zero; original state
  membership despite square placement; unchanged input objects.
- `verify_quality_browser.mjs`: all four participant datasets; AYAC02 flags and
  counts; actual pointer selection; normal/maximized rendering; synchronized
  ranges, named-view restore, unchanged scientific objects and both cameras;
  unknown/zero rail, CSV, PNG and SVG.
- Existing trajectory, participant and named-view tests remain applicable.
- `scripts/verify_migration.py` retains the frozen scientific baseline and
  independently rebuilds/checks the separate quality metadata.
- `scripts/check_sources.py`: only reviewed source files are staged. Datasets,
  generated HTML, screenshots, exports and read-depth payloads remain ignored.

When onboarding another dataset, provide an authenticated read-count adapter or
explicitly accept unknown depth. Preserve the full composition denominator,
record identity, source convention and reference population. Do not reuse a
count field solely because its name contains “reads.”

## Policy distribution and updates

This file is the maintained policy source in the VME repository. The build embeds
its Quick guide and full contents directly in the explorer. The **Quality rules**
button in the subject trajectory header opens the same document in normal and
maximized layouts; **Download full policy (.md)** downloads that embedded copy.
It works offline and through historical entry points without access to a local
absolute path or an external website.

The build also produces `quality.html` and `QUALITY_PREVIEW_POLICY.md` beside
the explorer. The readable page uses this same source, rule version and source
checksum. `about.html` links to it, and the research report library links to
the served policy page rather than maintaining another copy. All three resource
files are generated local assets, excluded from Git; this file remains the
authoritative source. After rebuilding, reload the page to see updated rules.

The policy identifier must match the quality-check implementation; a mismatch
stops the build. When changing thresholds, flag semantics, count definitions or
assignment-support rules, update the implementation, this document (including
the Quick guide) and acceptance checks in the same source commit, and advance
the policy identifier for a rule change. Editorial changes need not change the
rule identifier. The embedded document also carries its source SHA256 so its
exact contents can be verified independently.

Rebuild and reload to publish updated rules. An already open or older standalone
explorer retains its bundled policy until refreshed or replaced. Documentation
bundling prevents a separate web link from drifting away from the installed
explorer; it does not automatically infer documentation from changed algorithms.
