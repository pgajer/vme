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
