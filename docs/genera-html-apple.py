#!/usr/bin/env python3
"""Genera HTML del manuale in stile Apple (per stampa PDF)."""
import re
import pathlib

# Leggi markdown
md = pathlib.Path('MANUALE-GESTIONALE.md').read_text()

# === Parser markdown semplice ===
def parse_md(md_text):
    lines = md_text.split('\n')
    html = []
    in_list = False
    in_code = False
    in_table = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Code blocks
        if line.startswith('```'):
            if not in_code:
                html.append('<pre><code>')
                in_code = True
            else:
                html.append('</code></pre>')
                in_code = False
            i += 1
            continue
        
        if in_code:
            html.append(line.replace('<', '&lt;').replace('>', '&gt;'))
            i += 1
            continue
        
        # Tables
        if '|' in line and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-+', lines[i+1]):
            # Start table
            headers = [h.strip() for h in line.split('|') if h.strip()]
            html.append('<table><thead><tr>')
            for h in headers:
                html.append(f'<th>{h}</th>')
            html.append('</tr></thead><tbody>')
            i += 2
            while i < len(lines) and '|' in lines[i]:
                cells = [c.strip() for c in lines[i].split('|') if c.strip()]
                html.append('<tr>')
                for c in cells:
                    html.append(f'<td>{c}</td>')
                html.append('</tr>')
                i += 1
            html.append('</tbody></table>')
            continue
        
        # Headers
        if line.startswith('# '):
            html.append(f'<h1>{line[2:].strip()}</h1>')
        elif line.startswith('## '):
            html.append(f'<h2>{line[3:].strip()}</h2>')
        elif line.startswith('### '):
            html.append(f'<h3>{line[4:].strip()}</h3>')
        # Liste
        elif re.match(r'^\s*[-*]\s+', line):
            if not in_list:
                html.append('<ul>')
                in_list = True
            content = re.sub(r'^\s*[-*]\s+', '', line)
            content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', content)
            content = re.sub(r'\*(.+?)\*', r'<em>\1</em>', content)
            content = re.sub(r'`(.+?)`', r'<code>\1</code>', content)
            content = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content)
            html.append(f'<li>{content}</li>')
        elif re.match(r'^\d+\.\s+', line):
            if not in_list:
                html.append('<ol>')
                in_list = True
            content = re.sub(r'^\d+\.\s+', '', line)
            content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', content)
            html.append(f'<li>{content}</li>')
        else:
            if in_list:
                html.append('</ul>' if html[-1].find('<ul>') == -1 else '</ol>')
                in_list = False
            
            # Paragrafi normali
            if line.strip():
                content = line
                content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', content)
                content = re.sub(r'\*(.+?)\*', r'<em>\1</em>', content)
                content = re.sub(r'`(.+?)`', r'<code>\1</code>', content)
                content = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', content)
                html.append(f'<p>{content}</p>')
        
        i += 1
    
    if in_list:
        html.append('</ul>')
    
    return '\n'.join(html)


body_html = parse_md(md)

# Template HTML Apple-style
html = f'''<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Manuale Utente — Gestionale Righetti 1967</title>
<style>
@page {{
  size: A4;
  margin: 15mm;
}}

* {{
  box-sizing: border-box;
}}

body {{
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #1C1C1E;
  margin: 0 auto;
  padding: 0;
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
  max-width: 100%;
}}

/* Contenitore principale: centrato, largo 180mm */
.page {{
  max-width: 180mm;
  margin: 0 auto;
  padding: 20mm 0;
}}

h1 {{
  font-size: 26pt;
  font-weight: 700;
  color: #1C1C1E;
  margin: 30px 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 3px solid #007AFF;
  letter-spacing: -0.5px;
  page-break-before: always;
  page-break-after: avoid;
}}

h1:first-of-type {{
  page-break-before: avoid;
  margin-top: 0;
}}

h2 {{
  font-size: 16pt;
  font-weight: 600;
  color: #1C1C1E;
  margin: 24px 0 12px 0;
  letter-spacing: -0.3px;
  page-break-after: avoid;
}}

h3 {{
  font-size: 12.5pt;
  font-weight: 600;
  color: #3A3A3C;
  margin: 18px 0 8px 0;
  page-break-after: avoid;
}}

p {{
  margin: 8px 0;
  line-height: 1.6;
}}

ul, ol {{
  margin: 8px 0;
  padding-left: 24px;
}}

li {{
  margin: 4px 0;
  line-height: 1.55;
}}

strong {{
  font-weight: 600;
  color: #1C1C1E;
}}

em {{
  font-style: italic;
  color: #3A3A3C;
}}

code {{
  background: #F2F2F7;
  padding: 2px 6px;
  border-radius: 5px;
  font-family: "SF Mono", Menlo, Monaco, monospace;
  font-size: 9.5pt;
  color: #C41E3A;
}}

pre {{
  background: #F2F2F7;
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 9.5pt;
  line-height: 1.4;
}}

pre code {{
  background: none;
  padding: 0;
  color: #1C1C1E;
}}

table {{
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 10pt;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px #E5E5EA;
}}

table th {{
  background: #F2F2F7;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #1C1C1E;
  border-bottom: 1px solid #D1D1D6;
  font-size: 10pt;
}}

table td {{
  padding: 8px 12px;
  border-bottom: 1px solid #F2F2F7;
  color: #3A3A3C;
}}

table tr:last-child td {{
  border-bottom: none;
}}

table tr:nth-child(even) td {{
  background: #FAFAFC;
}}

a {{
  color: #007AFF;
  text-decoration: none;
}}

blockquote {{
  border-left: 4px solid #007AFF;
  padding: 10px 16px;
  margin: 14px 0;
  background: #F0F7FF;
  color: #1C1C1E;
  border-radius: 0 8px 8px 0;
  font-style: normal;
}}

blockquote p {{
  margin: 4px 0;
}}

hr {{
  border: none;
  border-top: 1px solid #E5E5EA;
  margin: 28px 0;
}}

/* Copertina stile Apple */
.cover {{
  text-align: center;
  padding: 60mm 20px 40px 20px;
  page-break-after: always;
  background: linear-gradient(180deg, #F9F9FB 0%, #FFFFFF 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}}

.cover-logo {{
  width: 100px;
  height: 100px;
  border-radius: 22px;
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 48pt;
  color: #ffffff;
  font-weight: 700;
  margin-bottom: 30px;
  box-shadow: 0 10px 40px rgba(0, 122, 255, 0.3);
}}

.cover h1 {{
  font-size: 34pt !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 0 16px 0 !important;
  page-break-before: avoid !important;
  color: #1C1C1E;
  letter-spacing: -1px;
}}

.cover-subtitle {{
  font-size: 16pt;
  color: #8E8E93;
  margin-bottom: 50px;
  font-weight: 400;
}}

.cover-meta {{
  display: inline-block;
  text-align: left;
  background: #ffffff;
  border: 1px solid #E5E5EA;
  border-radius: 16px;
  padding: 24px 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-top: 40px;
}}

.cover-meta-row {{
  padding: 6px 0;
  font-size: 12pt;
}}

.cover-meta-label {{
  color: #8E8E93;
  font-weight: 500;
  display: inline-block;
  width: 100px;
}}

.cover-meta-value {{
  color: #1C1C1E;
  font-weight: 600;
}}

.cover-footer {{
  margin-top: 60px;
  font-size: 10pt;
  color: #8E8E93;
}}

/* Box "novità" */
.novelty {{
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  color: #ffffff;
  padding: 16px 20px;
  border-radius: 12px;
  margin: 20px 0;
}}

.novelty strong {{
  color: #ffffff;
}}

/* Indice elegante */
.toc {{
  page-break-after: always;
}}

.toc h1 {{
  page-break-before: avoid;
}}

.toc-list {{
  list-style: none;
  padding: 0;
  margin: 30px 0;
}}

.toc-list li {{
  padding: 12px 0;
  border-bottom: 1px solid #F2F2F7;
  font-size: 13pt;
  color: #1C1C1E;
  font-weight: 500;
}}

.toc-list li:last-child {{
  border-bottom: none;
}}

.toc-num {{
  display: inline-block;
  width: 40px;
  color: #007AFF;
  font-weight: 600;
}}

/* Print */
@media print {{
  body {{
    font-size: 10pt;
    padding: 0;
    margin: 0;
  }}
  .page {{
    max-width: 100%;
    padding: 0;
    margin: 0;
  }}
  .cover {{
    min-height: 100vh;
    page-break-after: always;
    padding: 40mm 20mm 20mm 20mm;
  }}
  h1 {{
    font-size: 22pt;
    page-break-before: always;
  }}
  h1:first-of-type {{
    page-break-before: avoid;
  }}
  h2, h3 {{
    page-break-after: avoid;
  }}
  p, li, table, blockquote, pre {{
    page-break-inside: avoid;
  }}
  table {{
    page-break-inside: auto;
  }}
  tr {{
    page-break-inside: avoid;
    page-break-after: auto;
  }}
  img {{
    max-width: 100%;
    page-break-inside: avoid;
  }}
  .toc {{
    page-break-after: always;
  }}
}}
</style>
</head>
<body>
<div class="page">

<!-- COPERTINA -->
<div class="cover">
  <div class="cover-logo">📖</div>
  <h1>Manuale Utente</h1>
  <div class="cover-subtitle">Gestionale Studio</div>
  <div class="cover-meta">
    <div class="cover-meta-row">
      <span class="cover-meta-label">Versione</span>
      <span class="cover-meta-value">1.0</span>
    </div>
    <div class="cover-meta-row">
      <span class="cover-meta-label">Data</span>
      <span class="cover-meta-value">11 Ottobre 2026</span>
    </div>
  </div>
</div>

<!-- INDICE -->
<div class="toc">
  <h1>Indice</h1>
  <ol class="toc-list">
    <li><span class="toc-num">1.</span> Introduzione</li>
    <li><span class="toc-num">2.</span> Setup Iniziale</li>
    <li><span class="toc-num">3.</span> Clienti</li>
    <li><span class="toc-num">4.</span> Agenda</li>
    <li><span class="toc-num">5.</span> Percorsi</li>
    <li><span class="toc-num">6.</span> Fatture e DDT</li>
    <li><span class="toc-num">7.</span> Cassa Fiscale</li>
    <li><span class="toc-num">8.</span> Magazzino</li>
    <li><span class="toc-num">9.</span> Automazioni</li>
    <li><span class="toc-num">10.</span> Integrazioni</li>
    <li><span class="toc-num">11.</span> Analytics e Report</li>
    <li><span class="toc-num">12.</span> App Cliente</li>
    <li><span class="toc-num">13.</span> Sicurezza</li>
    <li><span class="toc-num">14.</span> FAQ</li>
    <li><span class="toc-num">15.</span> 🚀 In Arrivo: Chiamate AI Voice</li>
  </ol>
</div>

{body_html}

</div>
</body>
</html>
'''

pathlib.Path('manuale-gestionale-apple.html').write_text(html)
print("✅ manuale-gestionale-apple.html creato")
