"""Embed the maintained Markdown policy in the offline explorer (stdlib only).

This renderer covers this document's headings, paragraphs, flat lists, tables,
inline code and bold text. HTML is escaped; no remote resources are loaded.
"""
import hashlib
import html
import re
from urllib.parse import quote


def inline(text):
    parts = re.split(r'(`[^`]+`)', text)
    return ''.join('<code>'+html.escape(p[1:-1])+'</code>' if p.startswith('`')
                   else re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html.escape(p))
                   for p in parts)


def render(markdown):
    output = []
    for block in re.split(r'\n\s*\n', markdown.strip()):
        lines = block.splitlines()
        if block.startswith('#'):
            for line in lines:
                match = re.fullmatch(r'(#{1,6}) (.+)', line)
                if not match:
                    raise ValueError('Unsupported policy heading')
                level = min(6, len(match[1])+1)
                output.append(f'<h{level}>{inline(match[2])}</h{level}>')
        elif block.startswith('|'):
            rows = [[c.strip() for c in line.strip().strip('|').split('|')] for line in lines]
            if len(rows) < 2 or not all(re.fullmatch(r':?-+:?', cell) for cell in rows[1]):
                raise ValueError('Unsupported policy table')
            head = '<tr>'+''.join('<th scope="col">'+inline(c)+'</th>' for c in rows[0])+'</tr>'
            body = ''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[2:])
            output.append('<table><thead>'+head+'</thead><tbody>'+body+'</tbody></table>')
        elif re.match(r'(?:- |\d+\. )', block):
            tag = 'ul' if block.startswith('- ') else 'ol'
            items = []
            for line in lines:
                match = re.match(r'(?:- |\d+\. )(.*)', line)
                if match:
                    items.append(match[1])
                else:
                    items[-1] += ' '+line.strip()
            output.append(f'<{tag}>'+''.join('<li>'+inline(item)+'</li>' for item in items)+f'</{tag}>')
        else:
            output.append('<p>'+inline(' '.join(line.strip() for line in lines))+'</p>')
    return '\n'.join(output)


def policy_html(here):
    source = (here/'QUALITY_PREVIEW_POLICY.md').read_text()
    version = re.search(r'Policy identifier: `([^`]+)`', source)
    implementation = re.search(r"const trajectoryQualityVersion='([^']+)'", (here/'trajectory_quality.js').read_text())
    if not version or not implementation or version[1] != implementation[1]:
        raise ValueError('Quality policy and implementation versions differ')
    match = re.search(r'<!-- UI-SUMMARY-START -->\s*(.*?)\s*<!-- UI-SUMMARY-END -->', source, re.S)
    if not match:
        raise ValueError('Quality policy quick guide is missing')
    digest = hashlib.sha256(source.encode()).hexdigest()
    full = source.replace('<!-- UI-SUMMARY-START -->', '').replace('<!-- UI-SUMMARY-END -->', '')
    return ('<p id="qualityRulesVersion">Rules version: '+html.escape(version[1])+
            ' · Included with this explorer build</p><div id="qualityRulesSummary">'+render(match[1])+
            '</div><details id="qualityRulesFull"><summary>Full rules, sources and interpretation</summary>'+
            '<article data-policy-sha256="'+digest+'">'+render(full)+'</article></details>'+
            '<p><a id="qualityRulesDownload" download="QUALITY_PREVIEW_POLICY.md" href="data:text/markdown;charset=utf-8,'+
            quote(source, safe='')+'">Download full policy (.md)</a></p>')
