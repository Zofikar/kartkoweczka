#!/usr/bin/env python3

from pathlib import Path
import sys


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: patch_opencv_qr_shim.py "
            "<opencv-dir> <shim-source>"
        )

    opencv_dir = Path(sys.argv[1])
    shim_source = Path(sys.argv[2]).resolve()

    cmake_file = opencv_dir / "modules" / "js" / "CMakeLists.txt"

    text = cmake_file.read_text(encoding="utf-8")

    marker = "# CUSTOM_QR_ENCODER_SHIM"

    if marker in text:
        print("QR encoder shim already configured")
        return

    addition = f"""

# CUSTOM_QR_ENCODER_SHIM
target_sources(opencv_js PRIVATE
    "{shim_source.as_posix()}"
)
"""

    text += addition

    cmake_file.write_text(
        text,
        encoding="utf-8",
    )

    print(f"Added QR encoder shim: {shim_source}")


if __name__ == "__main__":
    main()