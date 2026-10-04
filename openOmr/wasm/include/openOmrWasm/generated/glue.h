// GENERATED FILE. DO NOT EDIT.
#pragma once

#include <openOmrWasm/generated/types.h>
#include <openOmrWasm/conversions.h>
#include <openOmr/api.h>

#include <memory>

namespace OpenOmrWasm::Generated
{
    OpenOmrWasm::Image generateQr(std::vector<std::uint8_t> data, OpenOmrWasm::Size size);
    std::vector<OpenOmrWasm::QrDetection> detectQrCode(OpenOmrWasm::Image image, std::optional<OpenOmrWasm::View> hints);
    OpenOmrWasm::ImageQuality checkImageQuality(OpenOmrWasm::Image image);

    class WasmSheetGenerator
    {
    public:
        WasmSheetGenerator();
        void initialize(OpenOmrWasm::Size size, emscripten::val revisionId);
        bool setFont(emscripten::val fontData);
        bool addQuestion(std::uint32_t questionNumber, std::uint32_t subQuestionNumber, emscripten::val answerLabels);
        OpenOmrWasm::Image generate();

    private:
        std::unique_ptr<OpenOmr::SheetGenerator> m_impl;
    };

    class WasmSheetGrader
    {
    public:
        WasmSheetGrader();
        std::vector<OpenOmrWasm::ArucoDetection> detectAruco(OpenOmrWasm::Image image);
        bool normalize(OpenOmrWasm::Size sheetOriginalSize);
        OpenOmrWasm::Image normalizedImage() const;
        std::optional<OpenOmrWasm::RevisionDetection> detectRevisionId();
        std::vector<std::uint8_t> gradeSheet(OpenOmrWasm::Size cellSize, OpenOmrWasm::Size innerCellSize);

    private:
        std::unique_ptr<OpenOmr::SheetGrader> m_impl;
    };
}
