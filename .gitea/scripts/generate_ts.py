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
    ]

    #
    # Classes
    #
    emitted_classes = set()

    for name, class_info in sorted(generator.classes.items()):
        if name not in white_list:
            continue

        emitted_classes.add(name)

        ns_prefix = class_namespace_prefix(name)

        lines.append(f"export interface {name} extends OpenCvDeletable {{")

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
                args = emit_args(variant, ns_prefix)
                ret = cpp_type_to_ts(variant.rettype, ns_prefix)

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
                    f"{cpp_type_to_ts(variant.rettype)};"
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
    for name, class_info in sorted(generator.classes.items()):
        if name not in white_list:
            continue

        ns_prefix = class_namespace_prefix(name)

        constructors = []

        for method in class_info.methods.values():
            if not method.is_constructor:
                continue

            if method.name not in white_list[name]:
                continue

            for variant in method.variants:
                constructors.append(
                    f"new ({emit_args(variant, ns_prefix)}): {name};"
                )

        if constructors:
            lines.append(f"  {name}: {{")
            for ctor in constructors:
                lines.append(f"    {ctor}")
            lines.append("  };")

    lines.append("}")
    lines.append("")

    Path(output).write_text(
        "\n".join(lines),
        encoding="utf-8",
    )

    print(f"Generated TypeScript declarations: {output}")