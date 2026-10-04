#pragma once

#include <openOmr/marker_positioner.h>

#include <opencv2/core/types.hpp>

#include <array>
#include <cstdint>
#include <optional>

namespace OpenOmr
{
    struct SheetVersionConfig
    {
        std::uint32_t version{};
        cv::Size referenceSize{};
        int guideInset{};
        int guideLength{};
        int guideThickness{};
        int quietZone{};
        int markerSize{};
        std::array<cv::Point, 5> markerCenters{};
        cv::Rect identityCodeArea{};
        cv::Size cellSize{};
        cv::Rect gridArea{};
        int questionColumnGutter{};
        std::uint32_t maxAnswerCount{};
        double innerSquareRatio{};
        int innerSquareThickness{};
        double answerFillThreshold{};
        double correctionFillThreshold{};
    };

    [[nodiscard]] std::optional<SheetVersionConfig> sheetVersionConfig(
        std::uint32_t version);

    [[nodiscard]] cv::Point markerCenter(
        SheetVersionConfig const& config,
        MarkerPosition position);

    [[nodiscard]] cv::Size innerSquareSize(
        SheetVersionConfig const& config);

    [[nodiscard]] std::uint32_t maxQuestionCount(
        SheetVersionConfig const& config,
        std::uint32_t maxAnswerCount);
}
