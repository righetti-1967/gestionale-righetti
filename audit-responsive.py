#!/usr/bin/env python3
"""
Audit responsive + design pulsanti.
Scansiona tutti i .tsx in src/ e trova pattern problematici.
"""
import os
import re
from collections import defaultdict

ROOT = '/Users/luca/Desktop/Tricolab/GESTIONALE/app/src'

# Pattern problematici per responsive
PATTERNS = {
    'grid-no-breakpoint': {
        'regex': re.compile(r'grid-cols-(\d+)'),
        'check': lambda m: m.group(1) != '1',  # griglie con più di 1 colonna senza breakpoint
        'desc': 'Grid senza breakpoint (grid-cols-N senza sm:/lg:)',
        'severity': 'medium',
    },
    'padding-fisso': {
        'regex': re.compile(r'className="[^"]*\bp-([6-9]|1[0-9])\b'),
        'check': lambda m: True,
        'desc': 'Padding grande fisso (p-6+) senza breakpoint',
        'severity': 'low',
    },
    'font-grande-fisso': {
        'regex': re.compile(r'\btext-(2xl|3xl|4xl)\b(?!.*\bsm:text)'),
        'check': lambda m: True,
        'desc': 'Font grande fisso (text-2xl+) senza sm:text',
        'severity': 'low',
    },
    'w-full-su-button': {
        'regex': re.compile(r'<button[^>]*className="[^"]*\bw-full\b'),
        'check': lambda m: True,
        'desc': 'Pulsante w-full (probabilmente troppo lungo su desktop)',
        'severity': 'high',
    },
    'flex-1-su-button': {
        'regex': re.compile(r'<button[^>]*className="[^"]*\bflex-1\b'),
        'check': lambda m: True,
        'desc': 'Pulsante flex-1 (si allarga per riempire)',
        'severity': 'medium',
    },
    'min-h-screen': {
        'regex': re.compile(r'min-h-screen'),
        'check': lambda m: True,
        'desc': 'min-h-screen senza breakpoint (può dare problemi su mobile)',
        'severity': 'medium',
    },
    'table-senza-overflow': {
        'regex': re.compile(r'<table(?![^>]*overflow)'),
        'check': lambda m: True,
        'desc': 'Tabella senza wrapper overflow-x-auto (problema su mobile)',
        'severity': 'medium',
    },
    'position-absolute-fisso': {
        'regex': re.compile(r'\babsolute\b(?!.*\bsm:|\blg:)'),
        'check': lambda m: True,
        'desc': 'Position absolute senza breakpoint',
        'severity': 'low',
    },
}

def scan_file(path):
    """Ritorna lista di problemi trovati nel file"""
    problemi = []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        return problemi

    for i, line in enumerate(lines, 1):
        for nome, p in PATTERNS.items():
            for match in p['regex'].finditer(line):
                if p['check'](match):
                    problemi.append({
                        'linea': i,
                        'tipo': nome,
                        'desc': p['desc'],
                        'severity': p['severity'],
                        'testo': line.strip()[:120],
                    })
    return problemi

def main():
    print('=' * 70)
    print('AUDIT RESPONSIVE + DESIGN PULSANTI')
    print('=' * 70)
    print()

    risultati = defaultdict(list)

    # Scansiona tutti i .tsx
    for root, dirs, files in os.walk(ROOT):
        for f in files:
            if f.endswith('.tsx'):
                path = os.path.join(root, f)
                problemi = scan_file(path)
                if problemi:
                    rel_path = path.replace(ROOT + '/', '')
                    risultati[rel_path] = problemi

    # Statistiche per tipo
    conteggi_tipo = defaultdict(int)
    conteggi_severity = defaultdict(int)

    for path, problemi in risultati.items():
        for p in problemi:
            conteggi_tipo[p['tipo']] += 1
            conteggi_severity[p['severity']] += 1

    print('STATISTICHE GLOBALI')
    print('-' * 70)
    print(f'File con problemi: {len(risultati)}')
    print(f'Totale problemi: {sum(conteggi_tipo.values())}')
    print()
    print('Per severità:')
    for sev in ['high', 'medium', 'low']:
        print(f'  {sev.upper()}: {conteggi_severity[sev]}')
    print()
    print('Per tipo:')
    for tipo, n in sorted(conteggi_tipo.items(), key=lambda x: -x[1]):
        print(f'  {tipo}: {n}')
    print()

    # Dettaglio per file (solo high e medium)
    print('=' * 70)
    print('DETTAGLIO PER FILE (solo HIGH e MEDIUM)')
    print('=' * 70)
    print()

    for path in sorted(risultati.keys()):
        problemi_filtrati = [
            p for p in risultati[path]
            if p['severity'] in ['high', 'medium']
        ]
        if not problemi_filtrati:
            continue

        print(f'📄 {path}')
        print(f'   {len(problemi_filtrati)} problemi high/medium')
        for p in problemi_filtrati[:8]:  # max 8 per file
            print(f'   L{p["linea"]}: [{p["severity"].upper()}] {p["desc"]}')
            print(f'      → {p["testo"]}')
        if len(problemi_filtrati) > 8:
            print(f'   ... e altri {len(problemi_filtrati) - 8}')
        print()

    # Riepilogo per file
    print('=' * 70)
    print('RIEPILOGO PER FILE')
    print('=' * 70)
    print()

    top = sorted(risultati.items(), key=lambda x: -len(x[1]))[:20]
    for path, problemi in top:
        high = sum(1 for p in problemi if p['severity'] == 'high')
        med = sum(1 for p in problemi if p['severity'] == 'medium')
        low = sum(1 for p in problemi if p['severity'] == 'low')
        print(f'{len(problemi):3d} ({high:2d}H {med:2d}M {low:2d}L)  {path}')

    print()
    print('=' * 70)
    print('FINE AUDIT')
    print('=' * 70)

if __name__ == '__main__':
    main()
