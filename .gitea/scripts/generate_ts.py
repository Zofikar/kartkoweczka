from pathlib import Path


def cpp_type_to_ts(tp: str, namespace_prefix = "") -> str:
    tp = tp.strip()

    tp = tp.replace("const ", "")
    tp = tp.replace("&", "")
    tp = tp.strip()

    replacements = {
        "": "void",
        "void": "void",
        "bool": "boolean",

        "char": "number",
        "uchar": "number",
        "short": "number",
        "int": "number",
        "unsigned": "number",
        "unsigned int": "number",
        "long": "number",
        "float": "number",
        "double": "number",
        "size_t": "number",

        "String": "string",
        "std::string": "string",

        "Mat": "Mat",
        "cv::Mat": "Mat",

        "AlgorithmHint": "number",
        "cv::AlgorithmHint": "number",

        "Scalar": "Scalar",
        "cv::Scalar": "Scalar",

        # Important JS-facing mappings
        "std::vector<cv::Mat>": "MatVector",
        "std::vector<Mat>": "MatVector",

        "InputArray": "Mat",
        "OutputArray": "Mat",
        "InputOutputArray": "Mat",

        "InputArrayOfArrays": "MatVector",
        "OutputArrayOfArrays": "MatVector",
    }

    if tp in replacements:
        return replacements[tp]

    if tp.startswith("Ptr<") and tp.endswith(">"):
        return cpp_type_to_ts(tp[4:-1], namespace_prefix)

    if tp.startswith("std::vector<") and tp.endswith(">"):
        inner = tp[len("std::vector<"):-1]

        if inner in ("cv::Mat", "Mat"):
            return "MatVector"

        return f"Array<{cpp_type_to_ts(inner, namespace_prefix)}>"

    # Fully-qualified C++ name.
    if "::" in tp:
        tp = tp.replace("cv::", "")
        return tp.replace("::", "_")

    # Unqualified custom type:
    # assume it belongs to the current JS namespace.
    if namespace_prefix:
        return f"{namespace_prefix}_{tp}"

    return tp


def class_namespace_prefix(name: str) -> str:
    if "_" not in name:
        return ""

    return name.rsplit("_", 1)[0]

def normalize_class_name(name: str) -> str:
    return (
        name
        .replace("cv::", "")
        .replace("::", "_")
        .replace(".", "_")
    )


def get_ts_bases(class_info, included_classes: set[str]) -> list[str]:
    bases = []

    for base in getattr(class_info, "bases", []):
        ts_base = normalize_class_name(base)

        if ts_base in included_classes:
            bases.append(ts_base)

    return bases


def is_factory_variant(class_info, func, variant) -> bool:
    """
    Mirror OpenCV embindgen's factory handling.

    create(...) methods and methods returning Ptr<ThisClass>
    are exposed as JS constructors by embindgen.
    """
    ret = variant.rettype.strip()

    if not ret:
        return False

    if func.name.startswith("create"):
        return True

    return ret == f"Ptr<{class_info.name}>"

def emit_args(variant, namespace_prefix: str = "") -> str:
    result = []

    for i, arg in enumerate(variant.args):
        name = arg.name or f"arg{i}"
        ts_type = cpp_type_to_ts(arg.tp, namespace_prefix)

        optional = "?" if arg.defval != "" else ""

        result.append(f"{name}{optional}: {ts_type}")

    return ", ".join(result)


def emit_typescript(generator, white_list, namespace_prefix_override, output):
    lines = [
        "/* AUTO-GENERATED FROM OPENCV EMBIND METADATA */",
        "/* eslint-disable */",
        "",
        "export interface OpenCvDeletable {",
        "  delete(): void;",
        "}",
        "",
        "export interface Mat extends OpenCvDeletable {",
        "  readonly rows: number;",
        "  readonly cols: number;",
        "  readonly data32S: Int32Array;",
        "  readonly data32F: Float32Array;",
        "}",
        "",
        "export interface MatVector extends OpenCvDeletable {",
        "  size(): number;",
        "  get(index: number): Mat;",
        "  push_back(value: Mat): void;",
        "}",
        "",
        "export interface Scalar {",
        "  0: number;",
        "  1: number;",
        "  2: number;",
        "  3: number;",
        "}",
        "",
    ]

    #
    # Classes
    #
    included_classes = {
        name
        for name in generator.classes
        if name in white_list
    }

    for name, class_info in sorted(generator.classes.items()):
        if name not in white_list:
            continue

        ns_prefix = class_namespace_prefix(name)

        bases = get_ts_bases(class_info, included_classes)

        if bases:
            extends = ", ".join(bases)
        else:
            extends = "OpenCvDeletable"

        lines.append(
            f"export interface {name} extends {extends} {{"
        )

        for prop in class_info.props:
            lines.append(
                f"  {prop.name}: {cpp_type_to_ts(prop.tp, ns_prefix)};"
            )

        for method in class_info.methods.values():
            if method.is_constructor:
                continue

            if method.name not in white_list[name]:
                continue

            for variant in method.variants:
                if variant.is_class_method:
                    continue

                if is_factory_variant(class_info, method, variant):
                    continue

                args = emit_args(
                    variant,
                    ns_prefix,
                )

                ret = cpp_type_to_ts(
                    variant.rettype,
                    ns_prefix,
                )

                lines.append(
                    f"  {method.name}({args}): {ret};"
                )

        lines.append("}")
        lines.append("")

    #
    # OpenCV module itself
    #
    lines.append("export interface OpenCv {")

    lines.append("  Mat: new (...args: any[]) => Mat;")
    lines.append("  MatVector: new (...args: any[]) => MatVector;")
    lines.append("  matFromImageData(image: ImageData): Mat;")
    lines.append("  encodeQRCode(text: string, correctionLevel: number): Mat;")

    #
    # Global functions
    #
    for ns_name, ns in sorted(generator.namespaces.items()):
        ns_parts = ns_name.split(".")

        if not ns_parts or ns_parts[0] != "cv":
            continue

        ns_id = "_".join(ns_parts[1:])

        ns_prefix = namespace_prefix_override.get(
            ns_id,
            ns_id,
        )

        for func in ns.funcs.values():
            js_name = func.name

            if ns_prefix:
                js_name = f"{ns_prefix}_{js_name}"

            print(
                "FUNC",
                "ns_name=", ns_name,
                "ns_id=", ns_id,
                "ns_prefix=", repr(ns_prefix),
                "func=", func.name,
                "js_name=", js_name,
                "whitelisted=", js_name in white_list.get("", []),
                                )

            if js_name not in white_list.get("", []):
                continue

            for variant in func.variants:
                lines.append(
                    f"  {js_name}({emit_args(variant, ns_prefix)}): "
                    f"{cpp_type_to_ts(variant.rettype, ns_prefix)};"
                )

    #
    # Constants/enums
    #
    for ns_name, ns in generator.namespaces.items():
        for name in ns.consts:
            lines.append(f"  {name}: number;")

    #
    # Constructors
    #
    #
    # Constructors + static class methods
    #
    for name, class_info in sorted(generator.classes.items()):
        if name not in white_list:
            continue

        ns_prefix = class_namespace_prefix(name)

        constructors = []
        static_methods = []

        for method in class_info.methods.values():
            if method.name not in white_list[name]:
                continue

            for variant in method.variants:
                #
                # Normal C++ constructor
                #
                if method.is_constructor:
                    constructors.append(
                        f"new ({emit_args(variant, ns_prefix)}): {name};"
                    )
                    continue

                #
                # Factory method.
                #
                # OpenCV embindgen turns things such as
                # QRCodeEncoder::create(...) into JS constructors.
                #
                if is_factory_variant(class_info, method, variant):
                    constructors.append(
                        f"new ({emit_args(variant, ns_prefix)}): {name};"
                    )
                    continue

                #
                # Other static/class methods
                #
                if variant.is_class_method:
                    args = emit_args(
                        variant,
                        ns_prefix,
                    )

                    ret = cpp_type_to_ts(
                        variant.rettype,
                        ns_prefix,
                    )

                    static_methods.append(
                        f"{method.name}({args}): {ret};"
                    )

        if constructors or static_methods:
            lines.append(f"  {name}: {{")

            for ctor in constructors:
                lines.append(
                    f"    {ctor}"
                )

            for method in static_methods:
                lines.append(
                    f"    {method}"
                )

            lines.append("  };")

    lines.append("}")
    lines.append("")

    Path(output).write_text(
        "\n".join(lines),
        encoding="utf-8",
    )

    print(f"Generated TypeScript declarations: {output}")