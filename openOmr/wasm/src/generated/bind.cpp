// GENERATED FILE. DO NOT EDIT.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <openOmrWasm/generated/glue.h>

using namespace emscripten;

namespace OpenOmrWasm::Detail {
    template<typename T>
    std::optional<T> val_to_optional(val v) {
        if (v.isNull() || v.isUndefined()) {
            return std::nullopt;
        }
        return v.as<T>();
    }

    template<typename T>
    val optional_to_val(const std::optional<T>& opt) {
        if (!opt.has_value()) {
            return val::null();
        }
        return val(*opt);
    }
}

EMSCRIPTEN_BINDINGS(OpenOmrWasm_generated)
{
    register_vector<std::uint8_t>("Vector_Bytes");

    enum_<OpenOmrWasm::PixelLayout>("PixelLayout")
        .value("Gray", OpenOmrWasm::PixelLayout::Gray)
        .value("RGBA", OpenOmrWasm::PixelLayout::RGBA);

    enum_<OpenOmrWasm::ImageQuality>("ImageQuality")
        .value("Good", OpenOmrWasm::ImageQuality::Good)
        .value("TooDark", OpenOmrWasm::ImageQuality::TooDark)
        .value("TooBright", OpenOmrWasm::ImageQuality::TooBright);

    value_object<OpenOmrWasm::Point>("Point")
        .field("x", &OpenOmrWasm::Point::x)
        .field("y", &OpenOmrWasm::Point::y);

    value_object<OpenOmrWasm::Size>("Size")
        .field("width", &OpenOmrWasm::Size::width)
        .field("height", &OpenOmrWasm::Size::height);

    value_object<OpenOmrWasm::View>("View")
        .field("x", &OpenOmrWasm::View::x)
        .field("y", &OpenOmrWasm::View::y)
        .field("width", &OpenOmrWasm::View::width)
        .field("height", &OpenOmrWasm::View::height);

    value_object<OpenOmrWasm::Image>("Image")
        .field("data", &OpenOmrWasm::Image::data)
        .field("width", &OpenOmrWasm::Image::width)
        .field("height", &OpenOmrWasm::Image::height)
        .field("layout", &OpenOmrWasm::Image::layout);

    value_object<OpenOmrWasm::ArucoDetection>("ArucoDetection")
        .field("id", &OpenOmrWasm::ArucoDetection::id)
        .field("tl", &OpenOmrWasm::ArucoDetection::tl)
        .field("tr", &OpenOmrWasm::ArucoDetection::tr)
        .field("bl", &OpenOmrWasm::ArucoDetection::bl)
        .field("br", &OpenOmrWasm::ArucoDetection::br);

    value_object<OpenOmrWasm::QrDetection>("QrDetection")
        .field("data", &OpenOmrWasm::QrDetection::data)
        .field("tl", &OpenOmrWasm::QrDetection::tl)
        .field("tr", &OpenOmrWasm::QrDetection::tr)
        .field("bl", &OpenOmrWasm::QrDetection::bl)
        .field("br", &OpenOmrWasm::QrDetection::br);

    value_object<OpenOmrWasm::RevisionDetection>("RevisionDetection")
        .field("revisionId", &OpenOmrWasm::RevisionDetection::revisionId)
        .field("tl", &OpenOmrWasm::RevisionDetection::tl)
        .field("tr", &OpenOmrWasm::RevisionDetection::tr)
        .field("bl", &OpenOmrWasm::RevisionDetection::bl)
        .field("br", &OpenOmrWasm::RevisionDetection::br);

    register_vector<OpenOmrWasm::QrDetection>("Vector_QrDetection");
    register_vector<OpenOmrWasm::ArucoDetection>("Vector_ArucoDetection");
    register_optional<OpenOmrWasm::RevisionDetection>();
    register_optional<OpenOmrWasm::View>();

    class_<OpenOmrWasm::Generated::WasmSheetGenerator> bind_SheetGenerator("SheetGenerator");
    bind_SheetGenerator.constructor<>();
    bind_SheetGenerator.function("initialize", &OpenOmrWasm::Generated::WasmSheetGenerator::initialize);
    bind_SheetGenerator.function("setFont", &OpenOmrWasm::Generated::WasmSheetGenerator::setFont);
    bind_SheetGenerator.function("addQuestion", &OpenOmrWasm::Generated::WasmSheetGenerator::addQuestion);
    bind_SheetGenerator.function("generate", &OpenOmrWasm::Generated::WasmSheetGenerator::generate);

    class_<OpenOmrWasm::Generated::WasmSheetGrader> bind_SheetGrader("SheetGrader");
    bind_SheetGrader.constructor<>();
    bind_SheetGrader.function("detectAruco", &OpenOmrWasm::Generated::WasmSheetGrader::detectAruco);
    bind_SheetGrader.function("normalize", &OpenOmrWasm::Generated::WasmSheetGrader::normalize);
    bind_SheetGrader.function("normalizedImage", &OpenOmrWasm::Generated::WasmSheetGrader::normalizedImage);
    bind_SheetGrader.function("detectRevisionId", &OpenOmrWasm::Generated::WasmSheetGrader::detectRevisionId);
    bind_SheetGrader.function("gradeSheet", &OpenOmrWasm::Generated::WasmSheetGrader::gradeSheet);

    function("generateQr", &OpenOmrWasm::Generated::generateQr);
    function("detectQrCode", &OpenOmrWasm::Generated::detectQrCode);
    function("checkImageQuality", &OpenOmrWasm::Generated::checkImageQuality);
}
