#!/usr/bin/env python3

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BUILD_DIR = ROOT / "build"

IMAGE_NAME = "open-omr:latest"

DOCKER_DIR = ROOT / "docker"
DOCKERFILE = DOCKER_DIR / "Dockerfile"

TESTS_BUILD_DIR = BUILD_DIR / "tests"
WASM_BUILD_DIR = BUILD_DIR / "wasm"

CONTAINER_SOURCE = "/src"
CONTAINER_BUILD_TESTS = "/build/tests"
CONTAINER_BUILD_WASM = "/build/wasm"


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def docker_mount(host: Path, container: str) -> str:
    return f"{host.resolve()}:{container}"


def build_image() -> None:
    run([
        "docker",
        "build",
        "-t",
        IMAGE_NAME,
        "-f",
        str(DOCKERFILE),
        str(DOCKER_DIR),
    ])


def common_docker_args() -> list[str]:
    BUILD_DIR.mkdir(exist_ok=True)

    return [
        "docker",
        "run",
        "--rm",
        "-v",
        docker_mount(ROOT, CONTAINER_SOURCE),
        "-v",
        docker_mount(BUILD_DIR, "/build"),
        "-w",
        CONTAINER_SOURCE,
        IMAGE_NAME,
    ]

def build_codegen() -> None:
    run([
        *common_docker_args(),
        "tools/embindgen.py"
    ])


def build_tests() -> None:
    TESTS_BUILD_DIR.mkdir(parents=True, exist_ok=True)

    run([
        *common_docker_args(),
        "cmake",
        "-S", CONTAINER_SOURCE,
        "-B", CONTAINER_BUILD_TESTS,
        "-G", "Ninja",
        "-DCMAKE_BUILD_TYPE=Debug",
        "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
    ])

    run([
        *common_docker_args(),
        "cmake",
        "--build",
        CONTAINER_BUILD_TESTS,
        "--parallel",
    ])


def test() -> None:
    build_tests()

    run([
        *common_docker_args(),
        "ctest",
        "--test-dir",
        CONTAINER_BUILD_TESTS,
        "--output-on-failure",
    ])


def preview() -> None:
    build_tests()
    command = [
        f"{CONTAINER_BUILD_TESTS}/openOmr_preview",
        f"{CONTAINER_SOURCE}/sheet-preview.bmp",
    ]
    run([*common_docker_args(), *command])


def build_wasm() -> None:
    WASM_BUILD_DIR.mkdir(parents=True, exist_ok=True)

    run([
        *common_docker_args(),
        "cmake",
        "-S", CONTAINER_SOURCE,
        "-B", CONTAINER_BUILD_WASM,
        "-G", "Ninja",
        "-DCMAKE_BUILD_TYPE=Release",
        "-DCMAKE_TOOLCHAIN_FILE=/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake",
    ])

    run([
        *common_docker_args(),
        "cmake",
        "--build",
        CONTAINER_BUILD_WASM,
        "--parallel",
    ])

    # Emscripten emits `emscripten::val` parameters as `any`. Array params use
    # val intentionally so callers can pass ordinary JS arrays; refine the
    # declaration to the schema-defined public type after linking.
    declaration = WASM_BUILD_DIR / "wasm" / "openOmr.d.ts"
    if declaration.exists():
        text = declaration.read_text(encoding="utf-8")
        text = re.sub(
            r"byteVectorView\(_0: Vector_Bytes\): any;",
            "byteVectorView(bytes: Vector_Bytes): Uint8Array;",
            text,
        )
        text = re.sub(
            r"addQuestion\(_0: number, _1: number, _2: any\): boolean;",
            "addQuestion(questionNumber: number, subQuestionNumber: number, "
            "answerLabels: Uint8Array[]): boolean;",
            text,
        )
        text = re.sub(
            r"setFont\(_0: any\): boolean;",
            "setFont(fontData: Uint8Array): boolean;",
            text,
        )
        text = re.sub(
            r"initialize\(_0: Size, _1: any\): void;",
            "initialize(size: Size, revisionId: Uint8Array): void;",
            text,
        )
        declaration.write_text(text, encoding="utf-8")

    shutil.copyfile(
        ROOT / "WASM_API.md",
        WASM_BUILD_DIR / "wasm" / "WASM_API.md",
    )


def test_wasm() -> None:
    build_wasm()
    run(["node", str(ROOT / "tests" / "test_wasm.mjs")])


def clean() -> None:
    if not BUILD_DIR.exists():
        return

    shutil.rmtree(BUILD_DIR)


def main() -> None:
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("image")
    subparsers.add_parser("codegen")
    subparsers.add_parser("tests")
    subparsers.add_parser("test")
    subparsers.add_parser("preview")
    subparsers.add_parser("wasm")
    subparsers.add_parser("wasm-test")
    subparsers.add_parser("all")
    subparsers.add_parser("clean")

    args = parser.parse_args()

    if args.command == "image":
        build_image()

    if args.command == "codegen":
        build_codegen()

    elif args.command == "tests":
        build_tests()

    elif args.command == "test":
        test()

    elif args.command == "preview":
        preview()

    elif args.command == "wasm":
        build_wasm()

    elif args.command == "wasm-test":
        test_wasm()

    elif args.command == "all":
        build_image()
        build_codegen()
        test()
        test_wasm()

    elif args.command == "clean":
        clean()


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)