#!/usr/bin/env python3
"""tokens.json -> tokens.css (variáveis CSS + tema do Tailwind v4).

    python build_tokens.py                 # escreve tokens.css ao lado
    python build_tokens.py out/tokens.css

Componentes usam classes de papel (bg-surface, text-muted, border-input,
bg-stage-3), nunca hex. Para rebrand: mude valores no tokens.json, rode
contrast.py e este script.
"""
import json
import pathlib
import sys

here = pathlib.Path(__file__).parent
tokens = json.loads((here / "tokens.json").read_text(encoding="utf-8"))
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "tokens.css"


def flat(obj, prefix=""):
    for k, v in obj.items():
        if k.startswith("_"):
            continue
        key = f"{prefix}-{k}" if prefix else k
        if isinstance(v, dict):
            yield from flat(v, key)
        else:
            yield key, v


colors = dict(flat(tokens["color"]))
root, theme = [], []

for name, value in colors.items():
    root.append(f"  --{name}: {value};")
    theme.append(f"  --color-{name}: var(--{name});")

# aliases para as classes lerem bem: text-fg, text-muted (em vez de text-text-muted)
theme.append("  --color-fg: var(--text);")
theme.append("  --color-muted: var(--text-muted);")

root.append(f"  --font-body: {tokens['font']['sans']};")
root.append(f"  --font-code: {tokens['font']['mono']};")
theme.append("  --font-sans: var(--font-body);")
theme.append("  --font-mono: var(--font-code);")

for name, t in tokens["type"].items():
    theme.append(f"  --text-{name}: {t['size'] / 16:g}rem;")
    theme.append(f"  --text-{name}--line-height: {t['line'] / t['size']:.4g};")
    theme.append(f"  --text-{name}--font-weight: {t['weight']};")
    if "tracking" in t:
        theme.append(f"  --text-{name}--letter-spacing: {t['tracking']};")

for name, px in tokens["radius"].items():
    theme.append(f"  --radius-{name}: {px}px;")
for name, value in tokens["shadow"].items():
    theme.append(f"  --shadow-{name}: {value};")

# Tailwind v4: spacing base de 4px (p-1 = 4px, p-3 = 12px...). A escala do
# tokens.json é toda múltipla de 2, então p-0.5 cobre os 2px.
theme.append("  --spacing: 4px;")

for name, value in tokens["motion"].items():
    if name != "ease":
        theme.append(f"  --duration-{name}: {value};")
theme.append(f"  --ease-out: {tokens['motion']['ease']};")

layout = tokens["layout"]
for name, value in layout.items():
    if name == "breakpoints":
        for bp, px in value.items():
            theme.append(f"  --breakpoint-{bp}: {px / 16:g}rem;")
    else:
        root.append(f"  --{name}: {value}px;")

css = (
    "/* GERADO por build_tokens.py a partir de tokens.json. Não edite à mão. */\n"
    "@import \"tailwindcss\";\n\n"
    ":root {\n" + "\n".join(root) + "\n}\n\n"
    "@theme inline {\n" + "\n".join(theme) + "\n}\n\n"
    "@layer base {\n"
    "  html { font-family: var(--font-body); color: var(--text); background: var(--bg); }\n"
    "  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }\n"
    "  @media (prefers-reduced-motion: reduce) {\n"
    "    *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }\n"
    "  }\n"
    "}\n"
)
out.write_text(css, encoding="utf-8")
print(f"escrito {out} ({len(colors)} cores, {len(tokens['type'])} tamanhos de texto)")
