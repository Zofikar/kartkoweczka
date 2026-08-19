#!/usr/bin/env python3

from pathlib import Path
import re
import sys


def main():
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: patch_opencv_embindgen.py <path-to-embindgen.py>"
        )

    path = Path(sys.argv[1])

    if not path.exists():
        raise RuntimeError(f"File not found: {path}")

    text = path.read_text(encoding="utf-8")

    # Make the patch idempotent.
    if "OPENCV_TS_OUTPUT" in text:
        print("embindgen.py already patched")
        return

    gen_pos = text.find(
        "    def gen(self, dst_file, src_files, core_bindings):"
    )

    if gen_pos == -1:
        raise RuntimeError(
            "Could not find JSWrapperGenerator.gen()"
        )

    before = text[:gen_pos]
    gen_text = text[gen_pos:]

    pattern = r"(\n\s*self\.resolve_class_inheritance\(\)\s*\n)"

    replacement = r"""\1
        ts_output = os.environ.get("OPENCV_TS_OUTPUT")
        if ts_output:
            import generate_ts
            generate_ts.emit_typescript(self, white_list, namespace_prefix_override, ts_output)

"""

    new_gen_text, count = re.subn(
        pattern,
        replacement,
        gen_text,
        count=1,
    )

    if count != 1:
        raise RuntimeError(
            f"Could not patch embindgen.py: expected 1 match, got {count}"
        )

    path.write_text(
        before + new_gen_text,
        encoding="utf-8",
        )

    print(f"Successfully patched: {path}")


if __name__ == "__main__":
    main()