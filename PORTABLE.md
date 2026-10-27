# Run updated VME source with separately supplied data

The interface source and research datasets are distributed separately. A Git
clone contains no observations, embeddings, private data package, or metadata
supplement. Do not run the scientific development build to update the interface.

The [MIT software license](LICENSE) does not cover the data package or metadata
supplement. Their separate access and reuse terms continue to apply; see
[licensing scope](LICENSING.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

## Setup for the October 23 Mac package

Requirements: macOS 11 or later, Git, Python 3.9 or later, and a WebGL browser.
No R, scientific packages, numerical preparation, or Python package installation
is needed. Git and Python are needed for setup and updates; the prepared viewer
then runs offline using the native server supplied in the original package.

Keep these two separately supplied items in Downloads:

- The unzipped `VME-Mac-Meeting-2026-10-23` folder, with its contents intact.
- `VME-metadata-2026-10-24.json`, the small companion metadata supplement.

The metadata supplement must be supplied separately by Pawel; it is not downloaded
by the setup script and is not in GitHub. Its size is approximately 704 KiB.
Keep the original package's `web` directory, native server, manifest, checksum
file, and launcher together. Do not select only the `web` directory.

Open Terminal and check that `git --version` and `python3 --version` work
(Python must be 3.9 or later). Clone the public repository over HTTPS; no GitHub
account or collaborator invitation is required for this read-only download:

```sh
cd "$HOME"
git clone https://github.com/pgajer/vme.git "$HOME/vme-source"
cd "$HOME/vme-source"
```

If you already have this clone, enter it and run `git pull --ff-only` instead.
Keep the source clone in `~/vme-source` and the runnable app in `~/vme`.
If the earlier instructions put the source clone in `~/vme` (or `~/VME`),
rename that clone to `vme-source` first; do not replace a clone with the app.
On typical Macs, capitalization does not distinguish two folder names.

From inside the `vme-source` folder, run:

```sh
python3 scripts/portable.py update \
  --package "$HOME/Downloads/VME-Mac-Meeting-2026-10-23" \
  --metadata "$HOME/Downloads/VME-metadata-2026-10-24.json" \
  --output "$HOME/vme"
```

Use the actual input paths if the files are stored elsewhere. The same command
installs the app initially or safely updates an existing prepared app. Stop the
viewer with **Control-C in its Terminal** before updating. Open `~/vme` in Finder
and double-click **Start VME.command**.
Keep its Terminal window open while exploring. The new copy uses
`http://127.0.0.1:43818/`; the original October 23 launcher uses port 43817.
Stop another copy on port 43818 before starting a different update. Browser
preferences are separate between ports; export/import named views if needed.

Choose the required dataset from the viewer's Dataset menu: comb-V3V4-tx,
HMP+U01 (40-participant panel), ZAPPS & PreSSMat, or Li / Lc neighborhoods.
Both V3–V4 and V4 neighborhood collections remain available.

If setup reports a missing package, check the unzipped folder name and paths.
An existing source clone or unrelated output folder will not be replaced.
A checksum or metadata mismatch means the files do not form the expected
package; contact Pawel for the matching files rather than changing or bypassing
the checks.

The setup verifies dataset assets against their SHA-256 hashes and binds the
metadata supplement to this exact package and its saved embedding coordinates.
It builds and validates a separate candidate before replacing the app, and
leaves the original package unchanged.
On the same filesystem it uses hard links for immutable assets; otherwise it
copies them. Treat both copies' data files as read-only. No remote downloads or
scientific calculations run during setup.

The supplied metadata adds full-population abundance summaries and the verified
neighborhood stress diagnostics introduced after October 23. Historical Fermat
targets that remain unverifiable are still labeled unavailable. It does not
replace sample observations, memberships, fitted paths, or embedding coordinates.

## Later interface updates

Stop the running viewer with Control-C in its Terminal, then run:

```sh
cd "$HOME/vme-source"
git pull --ff-only && python3 scripts/portable.py update
```

This updates the source first and installs the resulting viewer at `~/vme`.
The app remembers the data-package and metadata paths from setup, so keep those
files in place. To change them, supply `--package` and `--metadata` again.
Reopen `~/vme/Start VME.command` and reload an already open browser tab. Keeping
the same port preserves browser preferences and saved views.

The updater refuses concurrent updates and a running viewer. It validates the
candidate's data, generated scripts, receipt, and launcher before replacing the
app. A failed build leaves the old app in place; a failed replacement restores
it. If a process is killed between the two directory moves, the next update
recovers the previous app before attempting another build.

Each successful replacement keeps the old app under the printed
`~/vme-update-<unique-id>/previous` path. Failed candidates and diagnostic files
are retained in their own `vme-update-<unique-id>` folders. These folders are never removed automatically and can
use additional disk space. To restore an earlier copy manually, first stop VME,
move the current `~/vme` to another unused name, and move the chosen `previous`
folder back to `~/vme`. Do not delete the original data package.

A data revision or incompatible metadata format requires a separately supplied
new package or supplement. Preparation errors identify mismatches; do not bypass
them. `SOURCE_AND_DATA.json` in each prepared viewer records source, data,
metadata, and application identities. The older `prepare` command remains
available for creating an independent copy in a new folder.

Fitted paths are off by default. A saved view that explicitly enabled them still
restores that choice. The optional live R density service is not included. The
portable copy retains the original scientific release limitations and the four
exposed dataset choices; V4 remains an internal dependency of neighborhoods.

## Maintainer metadata export

This step requires the private development build and is not needed by recipients:

```sh
python3 scripts/portable.py export-metadata \
  --package /path/to/VME-Mac-Meeting-2026-10-23 \
  --output /path/to/VME-metadata-2026-10-24.json
```

Share the generated JSON through the same controlled channel as the data. It
contains research-derived summaries and diagnostics and does not belong in the
source repository. Existing output files are never replaced. Validate an update
against a source-only checkout and the previously delivered package before sharing.

## Optional max-normalized rebuilt-reference views

A separately supplied metadata supplement can add **Max-normalized · Euclidean**
and **Max-normalized · L∞** to the Sample embedding menu for comb-V3V4-tx's
**Rebuilt reference** population. The source update alone does not contain these
coordinates. Install the matching supplement once:

```sh
python3 scripts/portable.py update --metadata /path/to/VME-metadata-maxnorm.json
```

Later `python3 scripts/portable.py update` calls remember that file. The original
views remain available. **Sample embedding** selects the normalization and distance
metric. Selecting a CST or vertex automatically uses its saved local fit when
available; the title distinguishes a local fit from restricted population
coordinates. Clearing the selection returns to the population embedding.

A supplement containing local fits also enables local selection geometry for both
max-normalized methods: Rebuilt reference, All cohorts, Merged groups, at each
coverage level supplied in the supplement (60%, 70%, 80%, 90%, and 100% in the
expanded supplement),
with a CST group or vertex selected. These are independent fits of the entire
selected group or incident-state union. Other cohorts and coverage levels absent from an older supplement retain
population views, labelled as restricted population coordinates.
Local reference diamonds mark observed phylotype maxima within the fitted selection.
A selection containing one distinct composition uses a single point, with pairwise
error unavailable. Two compositions use an exact two-point layout. Larger selections
use sparse metric MDS with SGD, two tested starts (seeds 17 and 29), and 200 epochs
per start. The lower RMS relative-error start is retained; finishing the epoch
budget does not certify convergence. Existing 60% local views remain compatible.
Participant
joint views, top-3 geometry and pure-state comparison tools retain their existing
embeddings. The graph layout and state assignments do not change.

Each composition is divided by its largest abundance before computing Euclidean
or maximum-coordinate-difference (L∞) targets. The error label uses those targets,
counts each distinct profile once, and excludes reference markers. It shows the
verified exact error when all fitted profiles are displayed, and a reproducible
sampled estimate (or exact calculation for small sets) for filtered displays.
Three-dimensional proximity is an approximation; use original-space distances
for nearest-neighbor analysis. Existing exploratory eligibility holds remain.

Maintainers can package verified fits without refitting or changing the base data:

```sh
python3 scripts/max_normalized_supplement.py \
  --results /path/to/verified-analysis-results \
  --package /path/to/original-data-package \
  --metadata /path/to/existing-metadata.json \
  --output /path/to/new-metadata-maxnorm.json
```

The exporter checks record/profile identities, coordinate values, exact-evaluation
checksums and solver provenance. Setup additionally binds the supplement to the
base dataset, rebuilt population and composition matrix. Outputs remain private
data supplements under their own access and reuse terms, excluded from MIT.

## Independent pure-state vertex views

The expanded rebuilt-reference metadata supplement adds independent local
**sum-normalized Euclidean** fits for pure-state vertex selections in comb-V3V4-tx,
for every cohort and reference coverage level (60%, 70%, 80%, 90%, 100%).
These replace the former population-coordinate restrictions. Existing local fits
are reused only for identical composition membership in the same frozen data;
other selections have newly fitted coordinates. Duplicate compositions share a
point, while the sample count still includes their separate source records.
Reference diamonds use observed maxima within that local fit.

After obtaining the matching supplement separately, stop VME and run:

```sh
cd "$HOME/vme-source"
git pull --ff-only && python3 scripts/portable.py update \
  --metadata /path/to/VME-metadata-pure-local-2026-10-26.json
```

Use the actual supplied path. The updater checks that the supplement belongs to
your data package; the October 26 rebuilt-reference-only supplement cannot be
installed over the older October 23 package. Later updates remember the new
metadata path. Reopen `~/vme/Start VME.command` and reload the browser tab.

Local geometries are selected from saved coordinates; no fitting runs in the
browser. Population overviews and explicit common-reference comparisons keep
their shared coordinates. Older packages without this supplement remain usable
and label the fallback as a restricted population embedding.

## Optional developer validation

[On-demand validation](TESTING.md) describes focused checks, the integration
test, and the separate opt-in saved-layout audit. These tests are not part of
the update command and are not required for recipients to update VME.

## Dataset embedding supplements

The optional `datasetMaxNormalizedEmbeddings` metadata field adds max-normalized
Euclidean and L∞ methods for ZAPPS + PreSSMat and LSVF. The software repository contains
the viewer and validators; the coordinates remain in separately shared data.
The matching supplement is checked against the dataset and analysis revisions,
exact ordinary/participant memberships, coordinate receipts and complete method
coverage before installation. Existing L1-normalized views remain available.

Choose a method under **Sample view → Sample embedding**. Saved local fits are
used for selected states and vertex unions, in each cohort, in Pure/Merged mode
and at all five reference coverage targets. LSVF also includes its recorded
assay-availability subsets. Participant mode uses a separate
joint-state fit for the chosen method; Full reference uses that method's saved
population coordinates. Switching methods does not change records or assignments.
An installation without the matching supplement keeps these methods disabled.

The standard metadata installation/update command also accepts metadata containing
this bank; it does not compute embeddings or run integration/layout tests. The
coordinate bank loads only when its dataset is opened, in bounded JSON fragments.
