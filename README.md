# Vaginal Microbiome Explorer

Interactive browser views of human vaginal microbial communities.

The original VME software and documentation use the [MIT License](LICENSE).
Separately distributed datasets and metadata supplements are excluded; see
[licensing scope](LICENSING.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

See [CITATION.cff](CITATION.cff) for the software citation. Cite research datasets
separately according to their providers' guidance.

This repository contains the viewer runtime and setup tools. Research datasets,
saved embeddings, and metadata supplements are supplied separately by their
maintainer. A source download alone contains no sample data.

See [setup and updates](PORTABLE.md) to reuse the October 23, 2026 Mac data
package with the current interface. Setup requires Python 3.9 or later and no
additional Python packages. The prepared viewer runs offline on macOS 11+.

Scientific preparation scripts and reports are maintained separately. Existing
dataset release limits remain in effect. The viewer does not refit embeddings.

Checks that do not require research data:

```sh
python3 -m unittest discover -s scripts -p test_portable.py
node rank2_feature_graph/test_embedding_stress.mjs
node rank2_feature_graph/test_asset_loader.mjs
```
