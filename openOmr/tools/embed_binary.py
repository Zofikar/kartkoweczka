#!/usr/bin/env python3

import sys
from pathlib import Path


source = Path(sys.argv[1])
header = Path(sys.argv[2])
implementation = Path(sys.argv[3])
data = source.read_bytes()

header.parent.mkdir(parents=True, exist_ok=True)
implementation.parent.mkdir(parents=True, exist_ok=True)

header.write_text(
    "#pragma once\n\n"
    "#include <cstddef>\n"
    "#include <cstdint>\n\n"
    "namespace OpenOmr::Resources {\n"
    "extern std::uint8_t DefaultFont[];\n"
    "extern std::size_t const DefaultFontSize;\n"
    "}\n",
    encoding="utf-8",
)

rows = []
for offset in range(0, len(data), 16):
    rows.append("    " + ", ".join(f"0x{value:02x}" for value in data[offset:offset + 16]))

implementation.write_text(
    '#include "default_font.h"\n\n'
    "namespace OpenOmr::Resources {\n"
    "std::uint8_t DefaultFont[] = {\n"
    + ",\n".join(rows)
    + "\n};\n"
    "std::size_t const DefaultFontSize = sizeof(DefaultFont);\n"
    "}\n",
    encoding="utf-8",
)