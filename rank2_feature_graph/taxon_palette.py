"""Read the retained VMRC UI color specifications, without scientific data changes."""
import base64
import csv
import hashlib
from html import escape
import io
from pathlib import Path
import re

SOURCE_DATE = '2026-09-22'
SOURCES = {
    '16S_taxaKey.csv': ('140b8a6b28bdf0fa517c41a922dc1359c8567933c227cc6bd83a77369610c642', 27),
    'VIRGO2_taxaKey.csv': ('52ed438e2b50e80c02c82595ca3ecc35e8eff9427080bf253992e7b46f22b362', 53),
}
DOCUMENT_URL = 'https://app.basecamp.com/4298669/buckets/13926816/documents/10328686740'


def taxon_key(name):
    return ' '.join(name.replace('_', ' ').split()).lower()


def load_palette(here=None):
    here = Path(here) if here else Path(__file__).resolve().parent
    colors, origins, tables = {}, {}, []
    for filename, (digest, count) in SOURCES.items():
        raw = (here/'palettes'/filename).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError('VMRC palette source checksum mismatch: '+filename)
        reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
        if reader.fieldnames != ['Taxa', 'Michael_original_Color', 'Text', 'Color']:
            raise ValueError('Unexpected VMRC color columns: '+filename)
        rows, seen = list(reader), set()
        if len(rows) != count:
            raise ValueError('Unexpected VMRC row count: '+filename)
        for row in rows:
            key = taxon_key(row['Taxa'])
            if not key or key in seen or not row['Text']:
                raise ValueError('Missing/duplicate VMRC taxon: '+filename)
            seen.add(key)
            for column in ['Michael_original_Color', 'Color']:
                if not re.fullmatch(r'#[0-9a-fA-F]{6}', row[column]):
                    raise ValueError('Invalid VMRC hex color: '+filename)
            color = row['Color'].lower()
            if key in colors and colors[key] != color:
                raise ValueError('Conflicting VMRC recommended colors: '+key)
            colors[key] = color
            origins.setdefault(key, []).append(filename)
        tables.append({'filename': filename, 'sha256': digest, 'rows': rows,
                       'download': base64.b64encode(raw).decode('ascii')})
    return {'version': 'vmrc-2026-09-22', 'date': SOURCE_DATE, 'colors': colors,
            'sources': origins, 'tables': tables}


def palette_html(palette):
    sections = []
    for table in palette['tables']:
        rows = ''.join('<tr>'+''.join('<td>'+escape(row[key])+'</td>' for key in
                      ['Taxa', 'Michael_original_Color', 'Text'])+
                      '<td><span aria-hidden="true" style="display:inline-block;width:1em;height:1em;border:1px solid #667;vertical-align:middle;background:'+row['Color']+'"></span> '+row['Color']+'</td></tr>'
                      for row in table['rows'])
        sections.append(f'''<details><summary>{escape(table['filename'])} · {len(table['rows'])} entries</summary>
<p><a download="{escape(table['filename'])}" href="data:text/csv;base64,{table['download']}">Download original CSV</a></p>
<small>Original file SHA256: <code>{table['sha256']}</code></small>
<div style="overflow-x:auto"><table><thead><tr><th>Taxa</th><th>Michael_original_Color (historical)</th><th>Text (original label)</th><th>Color (recommended)</th></tr></thead><tbody>{rows}</tbody></table></div></details>''')
    return f'''<section id="taxon-colors"><h2>VMRC phylotype color reference</h2>
<p>Jacques Ravel shared these VIBRANT color specifications with the VMRC Research Team on September 22, 2026, in “Microbial Taxa Color Codes.” <a href="{DOCUMENT_URL}" target="_blank" rel="noopener noreferrer">Original Basecamp document</a>.</p>
<p>VME uses the final <code>Color</code> column for whole-sample abundance bars. The older <code>Michael_original_Color</code> column and original labels are retained for provenance. The 27-entry 16S table and 53-entry VIRGO2 table have 15 shared taxon names with identical recommended colors: 65 unique entries, including Other.</p>
<p>Matching uses full names, normalizing underscores, whitespace and case only. Distinct names and taxonomic suffixes remain distinct; no synonyms or genus/species substitutions are inferred. Unlisted taxa retain deterministic fallback colors. Custom choices override defaults and travel with named views. Other taxa stays fixed gray (#8c8c8c). Row labels use colored swatches and dark text so light recommended colors remain readable.</p>
{''.join(sections)}</section>'''
