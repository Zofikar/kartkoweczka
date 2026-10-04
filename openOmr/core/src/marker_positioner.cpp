#include <openOmr/marker_positioner.h>

#include <algorithm>
#include <cmath>
#include <limits>
#include <numbers>
#include <unordered_set>

namespace OpenOmr
{
    namespace
    {
        constexpr std::array<MarkerPosition, 4> CornerPositions{
            MarkerPosition::TL,
            MarkerPosition::TR,
            MarkerPosition::BR,
            MarkerPosition::BL,
        };

        std::optional<std::uint32_t> cornerValue(std::uint32_t id)
        {
            auto const it = std::ranges::find(MarkerPositioner::CornerIds, id);
            if (it == MarkerPositioner::CornerIds.end()) {
                return std::nullopt;
            }
            return static_cast<std::uint32_t>(
                std::distance(MarkerPositioner::CornerIds.begin(), it));
        }

        double circularDistance(double a, double b)
        {
            return std::abs(std::remainder(a - b, 360.0));
        }

        int quantizeRelativeRotation(double rotation, double base)
        {
            auto value = static_cast<int>(std::lround((rotation - base) / 90.0));
            value %= 4;
            if (value < 0) {
                value += 4;
            }
            return value * 90;
        }

        double sideOfLine(
            DetectedMarker const& a,
            DetectedMarker const& b,
            DetectedMarker const& point)
        {
            return (b.centerX - a.centerX) * (point.centerY - a.centerY)
                - (b.centerY - a.centerY) * (point.centerX - a.centerX);
        }

        DetectedMarker const* findByPosition(
            std::vector<PositionedMarker> const& positioned,
            MarkerPosition position)
        {
            auto const it = std::ranges::find_if(
                positioned,
                [position](PositionedMarker const& value) {
                    return value.position == position;
                });
            return it == positioned.end() ? nullptr : &it->marker;
        }
    }

    std::optional<std::array<std::uint32_t, 4>> MarkerPositioner::encodeVersion(
        std::uint32_t version)
    {
        if (version == 0 || version > LatestVersion) {
            return std::nullopt;
        }

        auto const index = version - 1;
        auto const tl = index / 16;
        auto const tr = (index / 4) % 4;
        auto const br = index % 4;
        auto const bl = (4 - ((tl + tr + br) % 4)) % 4;

        return std::array{
            CornerIds[tl], CornerIds[tr], CornerIds[br], CornerIds[bl]};
    }

    std::optional<std::uint32_t> MarkerPositioner::decodeVersion(
        std::array<std::optional<std::uint32_t>, 4> const& cornerIds)
    {
        std::array<std::optional<std::uint32_t>, 4> values{};
        std::size_t missingCount = 0;
        std::size_t missingIndex = 0;
        std::uint32_t sum = 0;

        for (std::size_t i = 0; i < cornerIds.size(); ++i) {
            if (!cornerIds[i]) {
                ++missingCount;
                missingIndex = i;
                continue;
            }
            values[i] = cornerValue(*cornerIds[i]);
            if (!values[i]) {
                return std::nullopt;
            }
            sum += *values[i];
        }

        if (missingCount > 1) {
            return std::nullopt;
        }
        if (missingCount == 1) {
            values[missingIndex] = (4 - (sum % 4)) % 4;
        } else if (sum % 4 != 0) {
            return std::nullopt;
        }

        auto const version = 1 + 16 * *values[0] + 4 * *values[1] + *values[2];
        if (version > LatestVersion) {
            return std::nullopt;
        }
        return version;
    }

    std::optional<std::array<MarkerPlacement, 5>> MarkerPositioner::placements(
        std::uint32_t version)
    {
        auto const ids = encodeVersion(version);
        if (!ids) {
            return std::nullopt;
        }
        return std::array{
            MarkerPlacement{(*ids)[0], MarkerPosition::TL, 90},
            MarkerPlacement{(*ids)[1], MarkerPosition::TR, 0},
            MarkerPlacement{(*ids)[2], MarkerPosition::BR, 180},
            MarkerPlacement{(*ids)[3], MarkerPosition::BL, 0},
            MarkerPlacement{FixedBottomId, MarkerPosition::FB, 0},
        };
    }

    std::optional<PositionedSheet> MarkerPositioner::position(
        std::span<DetectedMarker const> markers)
    {
        if (markers.size() < 4 || markers.size() > 5) {
            return std::nullopt;
        }

        std::unordered_set<std::uint32_t> seenFixedBottom;
        for (auto const& marker : markers) {
            if (marker.id != FixedBottomId && !cornerValue(marker.id)) {
                return std::nullopt;
            }
            if (marker.id == FixedBottomId && !seenFixedBottom.insert(marker.id).second) {
                return std::nullopt;
            }
        }

        double baseAngle = 0.0;
        double bestDistance = std::numeric_limits<double>::infinity();
        for (std::size_t i = 0; i + 1 < markers.size(); ++i) {
            for (std::size_t j = i + 1; j < markers.size(); ++j) {
                auto const distance = circularDistance(markers[i].rotation, markers[j].rotation);
                if (distance < bestDistance) {
                    baseAngle = markers[i].rotation;
                    bestDistance = distance;
                }
            }
        }

        std::vector<DetectedMarker> normalized(markers.begin(), markers.end());
        for (auto& marker : normalized) {
            marker.rotation = quantizeRelativeRotation(marker.rotation, baseAngle);
        }

        auto uniqueByRotation = [&normalized](int rotation) -> DetectedMarker const* {
            DetectedMarker const* result = nullptr;
            for (auto const& marker : normalized) {
                if (static_cast<int>(marker.rotation) != rotation) {
                    continue;
                }
                if (result != nullptr) {
                    return nullptr;
                }
                result = &marker;
            }
            return result;
        };

        DetectedMarker const* fb = nullptr;
        for (auto const& marker : normalized) {
            if (marker.id == FixedBottomId) {
                fb = &marker;
                break;
            }
        }
        auto const* tl = uniqueByRotation(90);
        auto const* br = uniqueByRotation(180);

        std::vector<PositionedMarker> positioned;
        positioned.reserve(markers.size());
        if (fb) positioned.push_back({MarkerPosition::FB, *fb});
        if (tl) positioned.push_back({MarkerPosition::TL, *tl});
        if (br) positioned.push_back({MarkerPosition::BR, *br});

        std::vector<DetectedMarker const*> remaining;
        for (auto const& marker : normalized) {
            bool const used = std::ranges::any_of(
                positioned,
                [&marker](PositionedMarker const& value) {
                    return &marker == &value.marker;
                });
            // PositionedMarker stores copies, so compare stable marker attributes instead.
            bool const matchesNamed =
                (fb && marker.id == fb->id && marker.centerX == fb->centerX && marker.centerY == fb->centerY)
                || (tl && marker.id == tl->id && marker.centerX == tl->centerX && marker.centerY == tl->centerY)
                || (br && marker.id == br->id && marker.centerX == br->centerX && marker.centerY == br->centerY);
            if (!used && !matchesNamed) {
                remaining.push_back(&marker);
            }
        }

        if (tl && br) {
            for (auto const* marker : remaining) {
                positioned.push_back({
                    sideOfLine(*tl, *br, *marker) > 0
                        ? MarkerPosition::BL
                        : MarkerPosition::TR,
                    *marker});
            }
        } else if ((tl || br) && remaining.size() == 2) {
            auto const sign = sideOfLine(*remaining[0], *remaining[1], tl ? *tl : *br);
            bool const firstIsTr = tl ? sign > 0 : sign < 0;
            positioned.push_back({firstIsTr ? MarkerPosition::TR : MarkerPosition::BL, *remaining[0]});
            positioned.push_back({firstIsTr ? MarkerPosition::BL : MarkerPosition::TR, *remaining[1]});
        } else {
            return std::nullopt;
        }

        std::unordered_set<int> positions;
        for (auto const& value : positioned) {
            if (!positions.insert(static_cast<int>(value.position)).second) {
                return std::nullopt;
            }
        }
        if (positioned.size() != markers.size()) {
            return std::nullopt;
        }

        std::array<std::optional<std::uint32_t>, 4> ids{};
        for (std::size_t i = 0; i < CornerPositions.size(); ++i) {
            if (auto const* marker = findByPosition(positioned, CornerPositions[i])) {
                ids[i] = marker->id;
            }
        }
        auto const version = decodeVersion(ids);
        if (!version) {
            return std::nullopt;
        }
        return PositionedSheet{*version, std::move(positioned)};
    }
}
