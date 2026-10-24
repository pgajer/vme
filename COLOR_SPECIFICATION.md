# VME color specification

Specification version 6 · reviewed 24 October 2026.

Canonical VME-wide reference for dataset authors and interface developers.
Read this specification when preparing, adding or revising a VME dataset.

This document consolidates the implemented color rules for Vaginal Microbiome
Explorer (VME). Version 6 extends the existing phylotype palette to thresholded
participant stacked bars, with a fixed gray remainder and the same taxon
overrides. Version 5 added a gray non-core pure-state inspection mode, retaining
the original-pair colors within selected merged groups and stable pair colors
across comb-V3V4 reference-coverage sensitivity comparisons. It changes no
taxonomic aliases, classifications or scientific results. The source files
linked below implement the rules. Proposed extensions are explicitly separated
from current behavior.

## Distinct meanings of color

| Object or mode | Color identity | Current scope |
|---|---|---|
| Phylotype in whole-sample abundance bars | Normalized full taxon name | Shared defaults and taxon overrides across datasets |
| Original top-2 CST pair or assigned merged group | Reference pair identifier | Dataset-specific categorical palette and overrides |
| top-3 CST | Unordered triple identifier | Deterministic categorical color; dataset-specific overrides |
| VALENCIA2 CST or subtype | Explicit CST/subtype label | Fixed mapping shared wherever that annotation is available |
| Participant visit | Visit label or order | Separate visit palette |
| Hypothetical group in taxon context | Checked group membership | Red highlight by default; gray stored merged-state context |
| Reference-taxon abundance in neighborhoods | Relative abundance, 0–100% | Continuous Viridis scale |
| Subject density along graph edges | Displayed relative density | Yellow for low density, red for high density |

A taxon color is not the color of every state containing that taxon. A merged
pair label names an assigned reference group; it does not establish that its
two taxa dominate every assigned sample. G1, G2 and similar group numbers are
local to the dataset and reference target, not universal biological identities.
The active legend determines the meaning of color in a particular view.

When one merged graph edge is selected outside Participant mode, the sample
view colors its members by their **original pure pairs**. The component table in
**Selected vertex or state** exposes counts, visibility checkboxes and color
pickers for these pairs. Its colors share the existing pair palette and overrides;
the graph retains merged-group colors. Hiding a component does not delete its
row or change assignments. Explicit VALENCIA2 and rank-3 color modes retain
precedence over these defaults.

## Pure core/non-core comparison

In the pure-state overview, **Show non-core samples only (gray)** colors all
non-core pure-state samples `#a8adb2`, overriding categorical sample palettes
for this inspection. Core samples retain the chosen sample palette. The toggle
uses the selected reference catalogue and eligible population, preserves all
assignments, and compares both sets in saved full-reference coordinates. Records
without a catalogued pair are reported separately rather than called non-core.

## Hypothetical-group context colors

The mutual-overlap browser's **Group only** view uses original pure-state colors
from the main VME palette when embedded, with local pure-state overrides. A
standalone browser uses a deterministic state-ID hue fallback. Overrides persist
by dataset release and do not change the main VME palette.

In **Taxon context**, records assigned to q%-merged reference pairs containing
the chosen taxon form the gray background (`#a8adb2`, opacity 0.3). Checked
hypothetical constituents use one highlight color, initially `#d62728`, opacity
0.85. The Highlight picker changes only that display color and is saved with the
comparison. Unchecked constituents stay hidden. Highlighted group records outside
the context remain visible. Gray/red encode context versus hypothetical membership,
not abundance, proximity, merge confidence or biological classifications. Pure-state
color pickers are disabled in this mode; their saved colors return in Group only.

## Phylotype palette

### Permanent sources and matching

The source palette is the validated union of
[16S_taxaKey.csv](rank2_feature_graph/palettes/16S_taxaKey.csv) and
[VIRGO2_taxaKey.csv](rank2_feature_graph/palettes/VIRGO2_taxaKey.csv), distributed by Jacques Ravel to
the VMRC Research Team on 22 September 2026. The detailed
development source record retains checksums and the
historical-name review. Both originals remain byte-identical.

Use the final `Color` column. `Michael_original_Color` is historical provenance;
`Text` is an original display label, not a taxonomic identity. The tables contain
27 and 53 rows, with 15 overlapping names and no recommended-color conflicts:
65 union entries, comprising 64 taxon names and `other`.

Matching replaces underscores with spaces, collapses whitespace and ignores
case. It does not remove rank prefixes or strain suffixes, infer synonyms, or
match abbreviated names. Species, genus and database-cluster labels remain
distinct. In particular, `g_Prevotella` and `Prevotella` are separate keys.

| Example taxon | Recommended color |
|---|---|
| Lactobacillus iners | `#00CD00` |
| Lactobacillus crispatus | `#FDCC45` |
| Gardnerella vaginalis | `#1E90FF` |
| Fannyhessea vaginae | `#0000CD` |
| Ca. Lachnocurva vaginae (source key `Ca_Lachnocurva_vaginae`) | `#EE7AE9` |
| Other taxa | `#8C8C8C` |

The complete source tables, rather than this example table, define the palette.
They are also available with swatches and original CSV downloads on the
About color-reference page in your running viewer.

### Resolution and editing

Resolve colors in this order:

1. A valid user override for the normalized full name.
2. An exact normalized match in the VMRC union.
3. A deterministic full-name hash color for an unlisted taxon.

The fallback is a VME display color, not a VMRC recommendation. The editor's
hover help identifies unmatched taxa. `trajectoryTaxonColor` in
[subject_trajectory.js](rank2_feature_graph/subject_trajectory.js) defines the exact hash and HSL
conversion. Fallback colors are stable for a given normalized name; uniqueness
or perceptual separation of all colors is not guaranteed.

The **Taxon colors** editor applies each choice across all state rows in the
whole-sample abundance view and across visits in **Stacked bars**. Stacked bars
show selected phylotypes at their measured whole-sample abundances; the
threshold-omitted mass is **Other phylotypes**, using the same fixed gray.
Visit-specific selection can therefore put a taxon in gray at one visit even
when it is individually colored at another. It does not recolor top-k CST categories, VALENCIA2
CSTs or graph vertices. Other taxa remains fixed gray `#8C8C8C` and is not
editable. Dark text beside colored swatches keeps pale colors readable.

Taxon overrides persist in trajectory browser preferences and in named-view
`trajectory.taxonColors`. Imported overrides use normalized full-name keys and
six-digit hexadecimal values, with at most 4,096 entries. Older named views
without the map restore defaults. Reset removes an override and resolves the
current default again. Image exports use the selected colors.

## Top-k CST palettes

### top-2 CST pairs and merged groups

The `edgeColor` function in [viewer.html](rank2_feature_graph/viewer.html), together with
[datasets.js](rank2_feature_graph/datasets.js), assigns each pair its position in the dataset's
full 100% reference graph edge order. The first 20 colors are:

```text
#1f77b4 #ff7f0e #2ca02c #d62728 #9467bd
#8c564b #e377c2 #7f7f7f #bcbd22 #17becf
#393b79 #637939 #8c6d31 #843c39 #7b4173
#3182bd #31a354 #756bb1 #e6550d #636363
```

Later positions use a deterministic HSL hue progression defined by `edgeColor`.
A valid pair override takes precedence; a null pair uses `#7C878D`. Colors are
keyed by the pair identifier, not the displayed G number or abbreviated label.
Original pairs and merged reference groups with the same pair identifier share
a color within the dataset. This is not a universal cross-dataset pair mapping:
feature identifiers and edge order can differ between releases.

The fixed-reference and rebuilt-reference sensitivity views of comb-V3V4 use
the current baseline's full 100% graph edge order for color identity. Removing
edges from a rebuilt graph must not shift the default colors of surviving
pairs. Both comparisons share the baseline pair overrides; VALENCIA2 and
phylotype color rules are unchanged. This is a display convention, not a
requirement to keep baseline graph topology or weights in the rebuilt view.

The **State colors** editor beneath the sample legend edits these categories.
Overrides are stored under `rank2-edge-colors:<dataset-id>@<revision>`; the
original combined V3–V4 key is retained as a migration fallback. Cohort views
share the dataset's pair preferences. Reset removes the selected override.

### top-3 CST states

[rank3.js](rank2_feature_graph/rank3.js) constructs each triple identifier by sorting its feature
IDs. `rank3Color` hashes that identifier into an HSL color with 62% saturation
and 43% lightness; null membership uses `#A7B2B7`. A valid custom color wins.
Overrides use the dataset ID plus triple ID in `vme-rank3-colors-v1`.
The **State colors** editor updates the applicable samples, faces and legend.
A triple is not colored by mixing its three phylotype colors.

### Persistence boundary

Pair/triple color overrides are browser preferences. Current named-view
capture does not include the `edgeColors` or `rank3Colors` maps. Saving state
selections and participant coloring modes therefore does not make custom
top-k CST palettes portable to another browser. Taxon overrides have explicit
named-view support, as described above. Do not promise equivalent persistence
for the two systems without extending and testing the saved-view format.

## VALENCIA2 CSTs and subtypes

[valencia2.js](rank2_feature_graph/valencia2.js) defines the following fixed display mappings.
These mappings are separate from the VMRC phylotype tables and from top-k CST
palettes. This document records VME's implementation; it does not assert that
these are a universal externally mandated CST standard.

| CST | Color | Subtype | Color |
|---|---|---|---|
| I | `#DF5555` | I-A | `#FF6868` |
| | | I-B | `#FFD4DA` |
| II | `#64A52D` | II | `#B4FF68` |
| III | `#ED993B` | III-A | `#FFBC6B` |
| | | III-B | `#E4A67B` |
| IV-A | `#9A7BC4` | IV-A | `#C1ADEC` |
| IV-B | `#5477C7` | IV-B | `#91A8ED` |
| IV-C | `#737373` | IV-C0 | `#989898` |
| | | IV-C1 | `#FFC0CB` |
| | | IV-C2 | `#A8E5E5` |
| | | IV-C3 | `#9ACC9A` |
| | | IV-C4 | `#800080` |
| V | `#B6A616` | V | `#FFFF71` |

When VALENCIA2 coloring is active and available, the corresponding mapping
colors sample profiles, including participant samples and supported neighborhood
views. A missing profile annotation uses `#7C878D`. Existing dimming and gray
background choices can remain gray. The taxon and top-k CST editors do not edit
these fixed mappings. Coloring uses existing annotations; selecting the palette
does not classify samples, change assignments or fit coordinates.

## Other encodings that must not be confused with CST identity

[participants.js](rank2_feature_graph/participants.js) assigns visit colors E `#087F8C`,
V1 `#CF7318`, V2 `#8651B5`, and Unordered `#6B7780`. Other ordered visits use a
deterministic order-based hue. The participant color selector can instead use
original pairs or assigned merged groups. Background samples can follow that
state scheme or remain gray. Subject graph density uses a separate yellow–red
scale; it is not the state palette.

[embedding_families.js](rank2_feature_graph/embedding_families.js) uses fixed 0–100% Viridis for
reference-taxon abundance. Its dominance display uses dark/light variants of
the parent pair color, with gray for ties. Those shades describe dominance
within the displayed pair, not independent taxon identities. Annotation-track
colors and quality/selection outlines have their own meanings, documented in
the annotation controls and help in the viewer and
[QUALITY_PREVIEW_POLICY.md](rank2_feature_graph/QUALITY_PREVIEW_POLICY.md).

## Proposed extensions — not activated

The historical-name proposal in the development documentation
includes Atopobium vaginae → Fannyhessea vaginae,
Sneathia amnii → Sneathia vaginalis, and BVAB1 → Ca. Lachnocurva vaginae.
These aliases are not currently applied. Additional proposals without a VMRC
target would require explicitly labeled VME extension colors.

A future alias registry should record the original name, target color identity,
dataset scope, relationship, evidence and review date. Color aliases must not
merge abundance columns or alter scientific taxonomy. Preserve genus/species,
strain and database-cluster distinctions; unresolved cases such as BVAB2 remain
unmapped. Preserve existing user overrides and explicitly handle conflicts.

A universal cross-dataset top-k CST palette, portable custom pair/triple colors in
named views, and an editable VALENCIA2 palette are also possible future changes;
this specification does not implement them.

## Maintenance and acceptance checks

Update this specification with any change to color meaning, precedence,
identity matching or persistence. Keep original VMRC CSVs and their provenance;
version any replacement or extension explicitly. Do not silently replace colors
by changing feature order, abbreviations or synonym handling.

For palette changes, check exact VMRC matches, fallback labels, distinct
rank/suffix keys, Other gray, override precedence, Reset, reload and applicable
named-view round trips. Compare normal/maximized views, legends and image
exports. Verify that assignments, abundance values, coordinates and current
camera/range settings are unchanged. Test active VALENCIA2 and gray-background
precedence separately from ordinary top-k CST coloring.

Existing checks include `test_taxon_palette.py`, `test_valencia2.mjs` and
`verify_named_views.mjs`; their scopes differ and none alone certifies every
color mode. New persistence or alias behavior requires focused tests.

The original version-1 documentation-only consolidation was checked against
the linked sources. Version 2 accompanies the comparison-view implementation
and its palette-order regression check. The About page currently
publishes the VMRC tables; this full specification is repository documentation.
