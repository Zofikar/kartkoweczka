#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import re
import sys
from dataclasses import dataclass, field
from typing import Any

import yaml


ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent


# =============================================================================
# Schema IR
# =============================================================================

@dataclass(frozen=True)
class TypeRef:
    kind: str
    name: str | None = None
    item: "TypeRef | None" = None


@dataclass
class FieldDef:
    name: str
    type: TypeRef


@dataclass
class StructDef:
    name: str
    fields: list[FieldDef] = field(default_factory=list)


@dataclass
class EnumDef:
    name: str
    values: list[str] = field(default_factory=list)


@dataclass
class ParamDef:
    name: str
    type: TypeRef


@dataclass
class FunctionDef:
    name: str
    cpp: str
    params: list[ParamDef]
    returns: TypeRef


@dataclass
class MethodDef:
    name: str
    cpp: str
    params: list[ParamDef]
    returns: TypeRef
    const: bool = False


@dataclass
class ClassDef:
    name: str
    cpp: str
    methods: list[MethodDef] = field(default_factory=list)


@dataclass
class Api:
    namespace: str
    include: str
    structs: list[StructDef]
    enums: list[EnumDef]
    functions: list[FunctionDef]
    classes: list[ClassDef]


# =============================================================================
# Parsing
# =============================================================================

_BUILTINS = {
    "bool",
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f32",
    "f64",
    "bytes",
    "byteBuffer",
    "void",
}


def parse_type(value: Any) -> TypeRef:
    if isinstance(value, str):
        value = value.strip()

        if value.endswith("[]"):
            return TypeRef(
                kind="array",
                item=parse_type(value[:-2]),
            )

        if value.endswith("?"):
            return TypeRef(
                kind="optional",
                item=parse_type(value[:-1]),
            )

        if value in _BUILTINS:
            return TypeRef(kind=value)

        return TypeRef(kind="named", name=value)

    if isinstance(value, dict):
        if "array" in value:
            return TypeRef(
                kind="array",
                item=parse_type(value["array"]),
            )

        if "optional" in value:
            return TypeRef(
                kind="optional",
                item=parse_type(value["optional"]),
            )

    raise ValueError(f"invalid type expression: {value!r}")


def parse_params(value: Any) -> list[ParamDef]:
    if value is None:
        return []

    if isinstance(value, dict):
        return [
            ParamDef(name=name, type=parse_type(type_value))
            for name, type_value in value.items()
        ]

    if isinstance(value, list):
        result: list[ParamDef] = []

        for item in value:
            if not isinstance(item, dict) or len(item) != 1:
                raise ValueError(
                    "list-form params must contain one-key mappings"
                )

            name, type_value = next(iter(item.items()))
            result.append(
                ParamDef(
                    name=name,
                    type=parse_type(type_value),
                )
            )

        return result

    raise ValueError(f"invalid params: {value!r}")


def parse_api(path: pathlib.Path) -> Api:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))

    if not isinstance(raw, dict):
        raise ValueError("api yaml root must be a mapping")

    namespace = str(raw.get("namespace", "OpenOmrWasm"))
    include = str(raw.get("include", "openOmr/api.h"))

    structs: list[StructDef] = []
    for name, spec in (raw.get("structs") or {}).items():
        spec = spec or {}
        fields = [
            FieldDef(field_name, parse_type(field_type))
            for field_name, field_type in (spec.get("fields") or {}).items()
        ]
        structs.append(StructDef(name=name, fields=fields))

    enums: list[EnumDef] = []
    for name, spec in (raw.get("enums") or {}).items():
        if isinstance(spec, list):
            values = [str(x) for x in spec]
        else:
            values = [str(x) for x in (spec or {}).get("values", [])]

        enums.append(EnumDef(name=name, values=values))

    functions: list[FunctionDef] = []
    for name, spec in (raw.get("functions") or {}).items():
        spec = spec or {}
        functions.append(
            FunctionDef(
                name=name,
                cpp=str(spec.get("cpp", name)),
                params=parse_params(spec.get("params")),
                returns=parse_type(spec.get("returns", "void")),
            )
        )

    classes: list[ClassDef] = []
    for name, spec in (raw.get("classes") or {}).items():
        spec = spec or {}
        methods: list[MethodDef] = []

        for method_name, method_spec in (spec.get("methods") or {}).items():
            method_spec = method_spec or {}

            methods.append(
                MethodDef(
                    name=method_name,
                    cpp=str(method_spec.get("cpp", method_name)),
                    params=parse_params(method_spec.get("params")),
                    returns=parse_type(method_spec.get("returns", "void")),
                    const=bool(method_spec.get("const", False)),
                )
            )

        classes.append(
            ClassDef(
                name=name,
                cpp=str(spec["cpp"]),
                methods=methods,
            )
        )

    return Api(
        namespace=namespace,
        include=include,
        structs=structs,
        enums=enums,
        functions=functions,
        classes=classes,
    )


# =============================================================================
# Validation
# =============================================================================

def named_types(api: Api) -> set[str]:
    return (
            {x.name for x in api.structs}
            | {x.name for x in api.enums}
            | {x.name for x in api.classes}
    )


def walk_type(t: TypeRef):
    yield t

    if t.item is not None:
        yield from walk_type(t.item)


def validate(api: Api) -> None:
    known = named_types(api)

    def check(t: TypeRef, where: str) -> None:
        for node in walk_type(t):
            if node.kind == "named" and node.name not in known:
                raise ValueError(
                    f"{where}: unknown WASM type {node.name!r}"
                )

    for struct in api.structs:
        for field in struct.fields:
            check(field.type, f"{struct.name}.{field.name}")

    for fn in api.functions:
        for p in fn.params:
            check(p.type, f"{fn.name}({p.name})")

        check(fn.returns, f"{fn.name} return")

    for cls in api.classes:
        for method in cls.methods:
            for p in method.params:
                check(
                    p.type,
                    f"{cls.name}.{method.name}({p.name})",
                )

            check(
                method.returns,
                f"{cls.name}.{method.name} return",
            )


# =============================================================================
# Naming + C++ Types
# =============================================================================

_CPP_SCALARS = {
    "bool": "bool",
    "u8": "std::uint8_t",
    "u16": "std::uint16_t",
    "u32": "std::uint32_t",
    "u64": "std::uint64_t",
    "i8": "std::int8_t",
    "i16": "std::int16_t",
    "i32": "std::int32_t",
    "i64": "std::int64_t",
    "f32": "float",
    "f64": "double",
    "void": "void",
}


def sanitize(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_]", "_", value)

    if not value:
        return "Anonymous"

    if value[0].isdigit():
        return "_" + value

    return value


def wasm_cpp_type(api: Api, t: TypeRef) -> str:
    if t.kind in _CPP_SCALARS:
        return _CPP_SCALARS[t.kind]

    if t.kind == "named":
        assert t.name is not None
        return f"{api.namespace}::{t.name}"

    if t.kind in {"bytes", "byteBuffer"}:
        return "std::vector<std::uint8_t>"

    if t.kind == "array":
        assert t.item is not None
        return f"std::vector<{wasm_cpp_type(api, t.item)}>"

    if t.kind == "optional":
        assert t.item is not None
        return f"std::optional<{wasm_cpp_type(api, t.item)}>"

    raise TypeError(t)


def public_cpp_type(api: Api, t: TypeRef) -> str:
    # JavaScript sequences should cross the public boundary as native JS
    # arrays rather than Embind's std::vector wrapper objects.
    if t.kind in {"array", "byteBuffer"}:
        return "emscripten::val"
    return wasm_cpp_type(api, t)


def ts_type(t: TypeRef) -> str:
    if t.kind == "void":
        return "void"

    if t.kind == "bool":
        return "boolean"

    if t.kind in {
        "u8", "u16", "u32", "u64",
        "i8", "i16", "i32", "i64",
        "f32", "f64",
    }:
        return "number"

    if t.kind in {"bytes", "byteBuffer"}:
        return "Uint8Array"

    if t.kind == "named":
        assert t.name is not None
        return t.name

    if t.kind == "array":
        assert t.item is not None
        return f"{ts_type(t.item)}[]"

    if t.kind == "optional":
        assert t.item is not None
        return f"{ts_type(t.item)} | null"

    raise TypeError(t)


# =============================================================================
# Generated public types header
# =============================================================================

def emit_types_h(api: Api) -> str:
    out: list[str] = []
    w = out.append

    w("// GENERATED FILE. DO NOT EDIT.")
    w("#pragma once")
    w("")
    w("#include <cstdint>")
    w("#include <optional>")
    w("#include <vector>")
    w("")
    w(f"namespace {api.namespace}")
    w("{")

    for enum in api.enums:
        w(f"    enum class {enum.name}")
        w("    {")
        for value in enum.values:
            w(f"        {value},")
        w("    };")
        w("")

    for struct in api.structs:
        w(f"    struct {struct.name}")
        w("    {")
        for field in struct.fields:
            w(
                f"        {wasm_cpp_type(api, field.type)} "
                f"{field.name}{{}};"
            )
        w("    };")
        w("")

    if api.classes:
        for cls in api.classes:
            w(f"    struct {cls.name} {{}};")
        w("")

    w("}")
    w("")

    return "\n".join(out)


# =============================================================================
# Generated public glue header
# =============================================================================

def class_wrapper_name(cls: ClassDef) -> str:
    return f"Wasm{cls.name}"


def emit_glue_h(api: Api) -> str:
    out: list[str] = []
    w = out.append

    w("// GENERATED FILE. DO NOT EDIT.")
    w("#pragma once")
    w("")
    w("#include <openOmrWasm/generated/types.h>")
    w("#include <openOmrWasm/conversions.h>")
    w(f"#include <{api.include}>")
    w("")
    w("#include <memory>")
    w("")
    w(f"namespace {api.namespace}::Generated")
    w("{")

    for fn in api.functions:
        params = ", ".join(
            f"{wasm_cpp_type(api, p.type)} {p.name}"
            for p in fn.params
        )

        w(
            f"    {wasm_cpp_type(api, fn.returns)} "
            f"{fn.name}({params});"
        )

    if api.functions and api.classes:
        w("")

    for cls in api.classes:
        wrapper = class_wrapper_name(cls)

        w(f"    class {wrapper}")
        w("    {")
        w("    public:")
        w(f"        {wrapper}();")

        for method in cls.methods:
            params = ", ".join(
                f"{public_cpp_type(api, p.type)} {p.name}"
                for p in method.params
            )

            suffix = " const" if method.const else ""

            w(
                f"        {wasm_cpp_type(api, method.returns)} "
                f"{method.name}({params}){suffix};"
            )

        w("")
        w("    private:")
        w(f"        std::unique_ptr<{cls.cpp}> m_impl;")
        w("    };")

        if cls is not api.classes[-1]:
            w("")

    w("}")
    w("")

    return "\n".join(out)


# =============================================================================
# Core forward declarations
# =============================================================================

def split_qualified_function(name: str) -> tuple[list[str], str]:
    parts = name.split("::")

    if len(parts) < 2:
        raise ValueError(
            f"core function must be namespace-qualified: {name!r}"
        )

    return parts[:-1], parts[-1]


def decltype_cpp_arg(api: Api, p: ParamDef) -> str:
    return (
        "decltype(WASM2CPP::Convert("
        f"std::declval<{wasm_cpp_type(api, p.type)}>()"
        "))"
    )


def core_return_type_expr(api: Api, fn: FunctionDef) -> str:
    return (
        "CPP2WASM::CoreType<"
        f"{wasm_cpp_type(api, fn.returns)}"
        ">"
    )


def emit_forward_decl(api: Api, fn: FunctionDef) -> str:
    namespaces, leaf = split_qualified_function(fn.cpp)

    args = ", ".join(
        decltype_cpp_arg(api, p)
        for p in fn.params
    )

    return_type = (
        "void"
        if fn.returns.kind == "void"
        else core_return_type_expr(api, fn)
    )

    lines: list[str] = []

    indent = ""

    for ns in namespaces:
        lines.append(f"{indent}namespace {ns}")
        lines.append(f"{indent}{{")
        indent += "    "

    lines.append(
        f"{indent}{return_type} {leaf}({args});"
    )

    for _ in reversed(namespaces):
        indent = indent[:-4]
        lines.append(f"{indent}}}")

    return "\n".join(lines)


# =============================================================================
# Glue implementation
# =============================================================================

def converted_arg_name(param: ParamDef) -> str:
    return f"cpp_{sanitize(param.name)}"


def emit_convert_arg(api: Api, param: ParamDef) -> str:
    if param.type.kind == "byteBuffer":
        return (
            f"auto {converted_arg_name(param)} = "
            f"WASM2CPP::ConvertBytes({param.name});"
        )
    if param.type.kind == "array":
        assert param.type.item is not None
        if param.type.item.kind == "bytes":
            return (
                f"auto {converted_arg_name(param)} = "
                f"WASM2CPP::ConvertByteStrings({param.name});"
            )
        item_type = wasm_cpp_type(api, param.type.item)
        return (
            f"auto {converted_arg_name(param)} = "
            f"WASM2CPP::ConvertArray<{item_type}>({param.name});"
        )
    return (
        f"auto {converted_arg_name(param)} = "
        f"WASM2CPP::Convert({param.name});"
    )


def emit_function_glue(api: Api, fn: FunctionDef) -> str:
    params = ",\n".join(
                f"{public_cpp_type(api, p.type)} {p.name}"
        for p in fn.params
    )

    signature = (
            f"{wasm_cpp_type(api, fn.returns)} {fn.name}("
            + ("\n" + params + "\n" if params else "")
            + ")"
    )

    lines = [signature, "{"]

    for p in fn.params:
        lines.append(f"    {emit_convert_arg(api, p)}")

    if fn.params:
        lines.append("")

    call_args = ", ".join(
        converted_arg_name(p)
        for p in fn.params
    )

    call = f"{fn.cpp}({call_args})"

    if fn.returns.kind == "void":
        lines.append(f"    {call};")
    else:
        lines.append(f"    auto response = {call};")
        lines.append("")
        lines.append("    return CPP2WASM::Convert(response);")

    lines.append("}")

    return "\n".join(lines)


def emit_method_impl(
        api: Api,
        cls: ClassDef,
        method: MethodDef,
) -> str:
    wrapper = class_wrapper_name(cls)

    params = ",\n".join(
        f"    {public_cpp_type(api, p.type)} {p.name}"
        for p in method.params
    )

    suffix = " const" if method.const else ""

    signature = (
            f"{wasm_cpp_type(api, method.returns)} "
            f"{wrapper}::{method.name}("
            + ("\n" + params + "\n" if params else "")
            + f"){suffix}"
    )

    lines = [signature, "{"]

    for p in method.params:
        lines.append(f"    {emit_convert_arg(api, p)}")

    if method.params:
        lines.append("")

    call_args = ", ".join(
        converted_arg_name(p)
        for p in method.params
    )

    call = f"m_impl->{method.cpp}({call_args})"

    if method.returns.kind == "void":
        lines.append(f"    {call};")
    else:
        lines.append(f"    auto response = {call};")
        lines.append("")
        lines.append("    return CPP2WASM::Convert(response);")

    lines.append("}")

    return "\n".join(lines)


def emit_glue_cpp(api: Api) -> str:
    out: list[str] = []
    w = out.append

    w("// GENERATED FILE. DO NOT EDIT.")
    w("")
    w("#include <memory>")
    w("#include <emscripten/val.h>")
    w("")
    w("#include <openOmrWasm/generated/glue.h>")
    w("")

    w(f"namespace {api.namespace}::Generated")
    w("{")
    w("")

    for index, fn in enumerate(api.functions):
        if index:
            w("")

        for line in emit_function_glue(api, fn).splitlines():
            w("    " + line if line else "")

    if api.functions and api.classes:
        w("")

    for class_index, cls in enumerate(api.classes):
        wrapper = class_wrapper_name(cls)

        if class_index:
            w("")

        w(
            f"    {wrapper}::{wrapper}()"
        )
        w(
            f"        : m_impl("
            f"std::make_unique<{cls.cpp}>()"
            f")"
        )
        w("    {")
        w("    }")

        for method in cls.methods:
            w("")

            for line in emit_method_impl(
                    api,
                    cls,
                    method,
            ).splitlines():
                w("    " + line if line else "")

    w("")
    w("}")
    w("")

    return "\n".join(out)


# =============================================================================
# Embind source
# =============================================================================

def emit_bind_cpp(api: Api) -> str:
    out: list[str] = []
    w = out.append

    w("// GENERATED FILE. DO NOT EDIT.")
    w("")
    w("#include <emscripten/bind.h>")
    w("#include <emscripten/val.h>")
    w("")
    w("#include <openOmrWasm/generated/glue.h>")
    w("")
    w("using namespace emscripten;")
    w("")

    # Emit standard JS-to-C++ sequence/optional binding converters into namespace
    w(f"namespace {api.namespace}::Detail {{")
    w("    template<typename T>")
    w("    std::optional<T> val_to_optional(val v) {")
    w("        if (v.isNull() || v.isUndefined()) {")
    w("            return std::nullopt;")
    w("        }")
    w("        return v.as<T>();")
    w("    }")
    w("")
    w("    template<typename T>")
    w("    val optional_to_val(const std::optional<T>& opt) {")
    w("        if (!opt.has_value()) {")
    w("            return val::null();")
    w("        }")
    w("        return val(*opt);")
    w("    }")
    w("}")
    w("")

    w(f"EMSCRIPTEN_BINDINGS({sanitize(api.namespace)}_generated)")
    w("{")

    # Register std::vector bindings using register_vector
    registered_vectors: dict[str, str] = {}
    registered_optionals: set[str] = set()

    def collect_and_register_vectors(t: TypeRef):
        if t.kind == "array":
            assert t.item is not None
            item_type = wasm_cpp_type(api, t.item)
            vec_type = f"std::vector<{item_type}>"
            if vec_type not in registered_vectors:
                registered_vectors[vec_type] = (
                    f'    register_vector<{item_type}>'
                    f'("{sanitize(type_token(t))}");'
                )
            collect_and_register_vectors(t.item)
        elif t.kind == "optional":
            assert t.item is not None
            item_type = wasm_cpp_type(api, t.item)
            if item_type not in registered_optionals:
                registered_optionals.add(item_type)
            collect_and_register_vectors(t.item)

    def type_token(t: TypeRef) -> str:
        if t.kind == "named":
            assert t.name is not None
            return t.name
        if t.kind in _CPP_SCALARS:
            return t.kind
        if t.kind == "bytes":
            return "Bytes"
        if t.kind == "byteBuffer":
            return "ByteBuffer"
        if t.kind == "array":
            assert t.item is not None
            return f"Vector_{type_token(t.item)}"
        if t.kind == "optional":
            assert t.item is not None
            return f"Optional_{type_token(t.item)}"
        raise TypeError(t)

    for struct in api.structs:
        for field in struct.fields:
            collect_and_register_vectors(field.type)

    # Array parameters are passed as emscripten::val and converted directly,
    # so they do not require register_vector public bindings.
    for fn in api.functions:
        for p in fn.params:
            if p.type.kind != "array":
                collect_and_register_vectors(p.type)
        collect_and_register_vectors(fn.returns)

    for cls in api.classes:
        for method in cls.methods:
            for p in method.params:
                if p.type.kind != "array":
                    collect_and_register_vectors(p.type)
            collect_and_register_vectors(method.returns)

    # `bytes` is represented as vector<uint8_t> and is a field dependency of
    # Image/QrDetection, so it must be registered before those value objects.
    w('    register_vector<std::uint8_t>("Vector_Bytes");')
    w("")

    for enum in api.enums:
        w(
            f'    enum_<{api.namespace}::{enum.name}>("{enum.name}")'
        )

        for i, value in enumerate(enum.values):
            suffix = ";" if i == len(enum.values) - 1 else ""

            w(
                f'        .value('
                f'"{value}", '
                f'{api.namespace}::{enum.name}::{value}'
                f'){suffix}'
            )

        w("")

    for struct in api.structs:
        w(
            f'    value_object<{api.namespace}::{struct.name}>'
            f'("{struct.name}")'
        )

        for i, field in enumerate(struct.fields):
            suffix = ";" if i == len(struct.fields) - 1 else ""

            w(
                f'        .field('
                f'"{field.name}", '
                f'&{api.namespace}::{struct.name}::{field.name}'
                f'){suffix}'
            )

        w("")

    # Container registrations depend on their element value objects. Emit
    # them after enums and structs so Embind/TypeScript generation can resolve
    # nested types such as optional<QrDetection> and vector<ArucoDetection>.
    for registration in registered_vectors.values():
        w(registration)
    for item_type in sorted(registered_optionals):
        w(f"    register_optional<{item_type}>();")
    if registered_vectors or registered_optionals:
        w("")

    for cls in api.classes:
        wrapper = (
            f"{api.namespace}::Generated::"
            f"{class_wrapper_name(cls)}"
        )

        binder = f"bind_{sanitize(cls.name)}"

        w(
            f'    class_<{wrapper}> {binder}("{cls.name}");'
        )
        w(f"    {binder}.constructor<>();")

        for method in cls.methods:
            w(
                f'    {binder}.function('
                f'"{method.name}", '
                f'&{wrapper}::{method.name}'
                f');'
            )

        w("")

    for fn in api.functions:
        w(
            f'    function('
            f'"{fn.name}", '
            f'&{api.namespace}::Generated::{fn.name}'
            f');'
        )

    w("}")
    w("")

    return "\n".join(out)


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--api",
        type=pathlib.Path,
        default=ROOT_DIR / "wasm/api.yaml",
    )

    parser.add_argument(
        "--include-out",
        type=pathlib.Path,
        default=(
                ROOT_DIR
                / "wasm/include/openOmrWasm/generated"
        ),
    )

    parser.add_argument(
        "--src-out",
        type=pathlib.Path,
        default=(
                ROOT_DIR
                / "wasm/src/generated"
        ),
    )

    args = parser.parse_args()

    api = parse_api(args.api)
    validate(api)

    args.include_out.mkdir(
        parents=True,
        exist_ok=True,
    )

    args.src_out.mkdir(
        parents=True,
        exist_ok=True,
    )

    types_path = args.include_out / "types.h"
    glue_header_path = args.include_out / "glue.h"

    glue_source_path = args.src_out / "glue.cpp"
    bind_source_path = args.src_out / "bind.cpp"

    types_path.write_text(
        emit_types_h(api),
        encoding="utf-8",
    )

    glue_header_path.write_text(
        emit_glue_h(api),
        encoding="utf-8",
    )

    glue_source_path.write_text(
        emit_glue_cpp(api),
        encoding="utf-8",
    )

    bind_source_path.write_text(
        emit_bind_cpp(api),
        encoding="utf-8",
    )

    print(f"generated {types_path}", file=sys.stderr)
    print(f"generated {glue_header_path}", file=sys.stderr)
    print(f"generated {glue_source_path}", file=sys.stderr)
    print(f"generated {bind_source_path}", file=sys.stderr)


if __name__ == "__main__":
    main()