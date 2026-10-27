# On-demand validation

Choose validation according to the change. None of the commands below runs from
`portable.py update`, a Git hook, or an automatic job. The updater keeps its
existing package-integrity and installation checks; those are separate from
these developer tests.

| Change or occasion | Validation |
| --- | --- |
| Routine edit | Syntax checks and the focused test for the changed feature; inspect the browser for UI changes. |
| Dataset loading, population filtering, selection, or saved-view changes; before sharing a release | Run the integration test against a matching built app and its installed datasets. |
| Saved-coordinate materialization or reference-anchor changes; occasional deliberate audit | Add `--audit-layouts` to run the exhaustive saved-layout audit. This is not required for every edit or every release. |

## Short commands

From the source clone, run these only when you want to validate:

```sh
./scripts/vme-test
./scripts/vme-test-audit
```

The first runs integration checks; the second adds the exhaustive layout audit.
They default to `~/vme/web/index.html`. Supply a built entry as the sole argument,
or set `VME_TEST_PAGE` once in your shell configuration for a development build:

```sh
export VME_TEST_PAGE="/path/to/development/index.http.html"
```

An explicit argument takes precedence over `VME_TEST_PAGE`. Paths containing
spaces are supported. Neither command builds, updates, or refits anything.
To use the names from any directory, add the clone's `scripts` directory to
your shell's PATH, for example in `~/.zshrc`:

```sh
export PATH="$HOME/vme-source/scripts:$PATH"
```

Open a new terminal after changing shell configuration. You can then type
`vme-test` or `vme-test-audit`. Use `vme-test --help` for usage.

## Requirements and scope

Use Node.js (verified with 23.11.0); no npm dependencies are required. Run from
the source repository. The test reads a **built HTTP entry page** and its local
manifest assets, not a URL, offline export, or source `viewer.html`. No server
needs to be running. Use a trusted local VME build: the test executes its
application JavaScript in a simulated browser environment.

The Git clone contains no scientific data. Obtain datasets and metadata
separately under their own access and reuse terms. The full integration test
currently requires these dataset IDs in the built app:

- `comb-V3V4-tx`, including deferred display and graph-layout fragments;
- `comb-V4-tx`;
- `umb-hmp-2019-panel` (40-participant panel);
- `zapps-pressmat-v4`.

It also checks loading and sample hover text for every additional dataset in
that manifest. The current rebuilt-reference fixture has 24,465 source records.
Use the matching supplied package and supplements; a smaller installation may
not contain all fixtures. Missing required fixtures stop the test rather than
produce a partial full-pass result. Prepared participant summaries and bundled
neighborhoods are optional and their availability is reported in the result.
Separately linked neighborhoods are not audited by this command.

Build or install the source revision you intend to validate first, following
[the portable instructions](PORTABLE.md). The test checks the application stored
in the entry page's manifest; editing the source clone alone does not update
that built application. Do not change dataset checksums or expected populations
to work around a mismatched installation.

## Integration checks

For an installed app at `~/vme`, run:

```sh
node rank2_feature_graph/verify_http_assets.mjs "$HOME/vme/web/index.html"
```

For a development build, pass its `index.http.html` instead. Absolute paths are
accepted, so the public checkout can test a separately built app without copying
data into the repository.

This mode exercises dataset admission and switching, sample hovers, failed and
stale lazy loads, representative edge and vertex selections, eight graph layout
settings, four participant-view restorations, saved cameras, population
compatibility, and pure-core/non-core counts. It checks that scientific bundles
are unchanged. It does **not** scan every saved layout.

## Exhaustive saved-layout audit

Run explicitly when needed:

```sh
node rank2_feature_graph/verify_http_assets.mjs "$HOME/vme/web/index.html" --audit-layouts
```

This runs the integration checks plus the separate
[`audit_saved_layouts.mjs`](rank2_feature_graph/audit_saved_layouts.mjs) module.
The additional audit loads all saved comb-V3V4-tx display-fit fragments and
checks the merged group, vertex-union and overview layouts across the available
cohorts and coverage levels. It compares record membership and coordinates with
the frozen fits, and reference anchors with independently scanned abundance
maxima. On the current fixture this covers 225 views, 14,971 layouts, and 48,314
anchors. Counts and elapsed seconds are reported for the package actually tested.
This is an audit of stored results, not an exhaustive test of every VME interaction
or every embedding family.

Neither mode fits new embeddings, changes datasets on disk, launches a browser,
or writes to browser preferences. The exhaustive mode can take substantially
more time and memory, so run it deliberately, not as part of ordinary updates.

## Narrow hover checks and results

For a hover-only change, use:

```sh
node rank2_feature_graph/verify_http_assets.mjs "$HOME/vme/web/index.html" --hover-only
```

This runs dataset admission/switching and hover checks and exits before the
broader selection and layout checks. It requires at least two datasets, including
coverage-dependent merged memberships. It is not a full integration pass.
`--hover-only` and `--audit-layouts` are mutually exclusive. `--help` prints usage.

A successful run exits with status 0 and prints JSON identifying its coverage.
The default integration result explicitly labels the exhaustive audit `not-run`.
An assertion or missing asset exits nonzero; preserve the error and identify the
source revision and data package when reporting it. Optional checks absent from
the package are not claimed as passed.

These tests use DOM and Plotly substitutes. They verify data flow and saved
geometry, not actual WebGL rendering, tooltip placement, or visual appearance.
UI changes still need a focused browser inspection. No browser pass or rebuild
is needed solely for edits to this test or its documentation.
