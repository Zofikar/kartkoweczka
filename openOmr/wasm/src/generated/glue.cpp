// GENERATED FILE. DO NOT EDIT.

#include <memory>
#include <emscripten/val.h>

#include <openOmrWasm/generated/glue.h>

namespace OpenOmrWasm::Generated
{

    OpenOmrWasm::Image generateQr(
    std::vector<std::uint8_t> data,
    OpenOmrWasm::Size size
    )
    {
        auto cpp_data = WASM2CPP::Convert(data);
        auto cpp_size = WASM2CPP::Convert(size);

        auto response = OpenOmr::generateQr(cpp_data, cpp_size);

        return CPP2WASM::Convert(response);
    }

    std::vector<OpenOmrWasm::QrDetection> detectQrCode(
    OpenOmrWasm::Image image,
    std::optional<OpenOmrWasm::View> hints
    )
    {
        auto cpp_image = WASM2CPP::Convert(image);
        auto cpp_hints = WASM2CPP::Convert(hints);

        auto response = OpenOmr::detectQrCode(cpp_image, cpp_hints);

        return CPP2WASM::Convert(response);
    }

    OpenOmrWasm::ImageQuality checkImageQuality(
    OpenOmrWasm::Image image
    )
    {
        auto cpp_image = WASM2CPP::Convert(image);

        auto response = OpenOmr::checkImageQuality(cpp_image);

        return CPP2WASM::Convert(response);
    }

    WasmSheetGenerator::WasmSheetGenerator()
        : m_impl(std::make_unique<OpenOmr::SheetGenerator>())
    {
    }

    void WasmSheetGenerator::initialize(
        OpenOmrWasm::Size size,
        emscripten::val revisionId
    )
    {
        auto cpp_size = WASM2CPP::Convert(size);
        auto cpp_revisionId = WASM2CPP::ConvertBytes(revisionId);

        m_impl->initialize(cpp_size, cpp_revisionId);
    }

    bool WasmSheetGenerator::setFont(
        emscripten::val fontData
    )
    {
        auto cpp_fontData = WASM2CPP::ConvertBytes(fontData);

        auto response = m_impl->setFont(cpp_fontData);

        return CPP2WASM::Convert(response);
    }

    bool WasmSheetGenerator::addQuestion(
        std::uint32_t questionNumber,
        std::uint32_t subQuestionNumber,
        emscripten::val answerLabels
    )
    {
        auto cpp_questionNumber = WASM2CPP::Convert(questionNumber);
        auto cpp_subQuestionNumber = WASM2CPP::Convert(subQuestionNumber);
        auto cpp_answerLabels = WASM2CPP::ConvertByteStrings(answerLabels);

        auto response = m_impl->addQuestion(cpp_questionNumber, cpp_subQuestionNumber, cpp_answerLabels);

        return CPP2WASM::Convert(response);
    }

    OpenOmrWasm::Image WasmSheetGenerator::generate()
    {
        auto response = m_impl->generate();

        return CPP2WASM::Convert(response);
    }

    WasmSheetGrader::WasmSheetGrader()
        : m_impl(std::make_unique<OpenOmr::SheetGrader>())
    {
    }

    std::vector<OpenOmrWasm::ArucoDetection> WasmSheetGrader::detectAruco(
        OpenOmrWasm::Image image
    )
    {
        auto cpp_image = WASM2CPP::Convert(image);

        auto response = m_impl->detectAruco(cpp_image);

        return CPP2WASM::Convert(response);
    }

    bool WasmSheetGrader::normalize(
        OpenOmrWasm::Size sheetOriginalSize
    )
    {
        auto cpp_sheetOriginalSize = WASM2CPP::Convert(sheetOriginalSize);

        auto response = m_impl->normalize(cpp_sheetOriginalSize);

        return CPP2WASM::Convert(response);
    }

    OpenOmrWasm::Image WasmSheetGrader::normalizedImage() const
    {
        auto response = m_impl->normalizedImage();

        return CPP2WASM::Convert(response);
    }

    std::vector<std::uint8_t> WasmSheetGrader::alignmentDiagnostics() const
    {
        auto response = m_impl->alignmentDiagnostics();

        return CPP2WASM::Convert(response);
    }

    std::vector<std::uint8_t> WasmSheetGrader::overlayDiagnostics() const
    {
        auto response = m_impl->overlayDiagnostics();

        return CPP2WASM::Convert(response);
    }

    std::optional<OpenOmrWasm::RevisionDetection> WasmSheetGrader::detectRevisionId()
    {
        auto response = m_impl->detectRevisionId();

        return CPP2WASM::Convert(response);
    }

    std::vector<std::uint8_t> WasmSheetGrader::gradeSheet(
        OpenOmrWasm::Size cellSize,
        OpenOmrWasm::Size innerCellSize
    )
    {
        auto cpp_cellSize = WASM2CPP::Convert(cellSize);
        auto cpp_innerCellSize = WASM2CPP::Convert(innerCellSize);

        auto response = m_impl->gradeSheet(cpp_cellSize, cpp_innerCellSize);

        return CPP2WASM::Convert(response);
    }

}
