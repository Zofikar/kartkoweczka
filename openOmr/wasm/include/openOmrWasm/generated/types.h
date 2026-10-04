// GENERATED FILE. DO NOT EDIT.
#pragma once

#include <cstdint>
#include <optional>
#include <vector>

namespace OpenOmrWasm
{
    enum class PixelLayout
    {
        Gray,
        RGBA,
    };

    enum class ImageQuality
    {
        Good,
        TooDark,
        TooBright,
    };

    struct Point
    {
        std::uint32_t x{};
        std::uint32_t y{};
    };

    struct Size
    {
        std::uint32_t width{};
        std::uint32_t height{};
    };

    struct View
    {
        std::uint32_t x{};
        std::uint32_t y{};
        std::uint32_t width{};
        std::uint32_t height{};
    };

    struct Image
    {
        std::vector<std::uint8_t> data{};
        std::uint32_t width{};
        std::uint32_t height{};
        OpenOmrWasm::PixelLayout layout{};
    };

    struct ArucoDetection
    {
        std::uint32_t id{};
        OpenOmrWasm::Point tl{};
        OpenOmrWasm::Point tr{};
        OpenOmrWasm::Point bl{};
        OpenOmrWasm::Point br{};
    };

    struct QrDetection
    {
        std::vector<std::uint8_t> data{};
        OpenOmrWasm::Point tl{};
        OpenOmrWasm::Point tr{};
        OpenOmrWasm::Point bl{};
        OpenOmrWasm::Point br{};
    };

    struct RevisionDetection
    {
        std::vector<std::uint8_t> revisionId{};
        OpenOmrWasm::Point tl{};
        OpenOmrWasm::Point tr{};
        OpenOmrWasm::Point bl{};
        OpenOmrWasm::Point br{};
    };

    struct SheetGenerator {};
    struct SheetGrader {};

}
