#pragma once

#include <array>
#include <cstdint>
#include <optional>
#include <span>
#include <vector>

namespace OpenOmr
{
    enum class MarkerPosition
    {
        TL,
        TR,
        BR,
        BL,
        FB,
    };

    struct MarkerPlacement
    {
        std::uint32_t id{};
        MarkerPosition position{};
        std::uint16_t rotation{};
    };

    struct DetectedMarker
    {
        std::uint32_t id{};
        double centerX{};
        double centerY{};
        double rotation{};
    };

    struct PositionedMarker
    {
        MarkerPosition position{};
        DetectedMarker marker{};
    };

    struct PositionedSheet
    {
        std::uint32_t version{};
        std::vector<PositionedMarker> markers{};
    };

    class MarkerPositioner
    {
    public:
        static constexpr std::uint32_t LatestVersion = 64;
        static constexpr std::uint32_t FixedBottomId = 31;
        static constexpr std::array<std::uint32_t, 4> CornerIds{3, 5, 25, 26};

        [[nodiscard]] static std::optional<std::array<std::uint32_t, 4>>
        encodeVersion(std::uint32_t version);

        [[nodiscard]] static std::optional<std::uint32_t> decodeVersion(
            std::array<std::optional<std::uint32_t>, 4> const& cornerIds);

        [[nodiscard]] static std::optional<std::array<MarkerPlacement, 5>>
        placements(std::uint32_t version);

        [[nodiscard]] static std::optional<PositionedSheet> position(
            std::span<DetectedMarker const> markers);
    };
}
