#pragma once

#include <openOmr/api.h>
#include <openOmrWasm/generated/types.h>
#include <emscripten/val.h>

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace OpenOmrWasm::WASM2CPP
{
    template<typename T>
    T Convert(T value)
    {
        return value;
    }

    std::string Convert(std::vector<std::uint8_t> const& value);
    std::vector<std::uint8_t> ConvertBytes(emscripten::val const& value);
    std::vector<std::string> Convert(
        std::vector<std::vector<std::uint8_t>> const& value);
    std::vector<std::string> ConvertByteStrings(emscripten::val const& value);
    cv::Size Convert(Size const& value);
    cv::Rect Convert(View const& value);
    std::optional<cv::Rect> Convert(std::optional<View> const& value);
    cv::Mat Convert(Image const& value);
}

namespace OpenOmrWasm::CPP2WASM
{
    template<typename T>
    T Convert(T value)
    {
        return value;
    }

    std::vector<std::uint8_t> Convert(std::string const& value);
    Image Convert(cv::Mat const& value);
    Point Convert(OpenOmr::Point const& value);
    QrDetection Convert(OpenOmr::QrDetection const& value);
    RevisionDetection Convert(OpenOmr::RevisionDetection const& value);
    ArucoDetection Convert(OpenOmr::ArUcoDetection const& value);
    ImageQuality Convert(OpenOmr::ImageQuality value);
    std::vector<QrDetection> Convert(
        std::vector<OpenOmr::QrDetection> const& value);
    std::vector<ArucoDetection> Convert(
        std::vector<OpenOmr::ArUcoDetection> const& value);
    std::optional<QrDetection> Convert(
        std::optional<OpenOmr::QrDetection> const& value);
    std::optional<RevisionDetection> Convert(
        std::optional<OpenOmr::RevisionDetection> const& value);
}