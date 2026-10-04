#include <openOmr/marker_positioner.h>
#include <openOmr/sheet_dictionary.h>

#include <algorithm>
#include <array>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <numbers>
#include <optional>
#include <vector>

namespace
{
    using namespace OpenOmr;

    struct BaseMarker
    {
        MarkerPosition position;
        double x;
        double y;
    };

    constexpr std::array<BaseMarker, 5> BaseMarkers{{
        {MarkerPosition::TL, 100, 100},
        {MarkerPosition::TR, 900, 100},
        {MarkerPosition::BR, 900, 900},
        {MarkerPosition::BL, 100, 900},
        {MarkerPosition::FB, 200, 900},
    }};

    MarkerPlacement const& placementAt(
        std::array<MarkerPlacement, 5> const& placements,
        MarkerPosition position)
    {
        auto const it = std::ranges::find_if(
            placements,
            [position](MarkerPlacement const& value) {
                return value.position == position;
            });
        assert(it != placements.end());
        return *it;
    }

    std::vector<DetectedMarker> makeDetected(
        std::uint32_t version,
        int pageRotation,
        std::optional<MarkerPosition> missing)
    {
        auto const placements = MarkerPositioner::placements(version);
        assert(placements);

        auto const radians = pageRotation * std::numbers::pi / 180.0;
        auto const cosine = std::cos(radians);
        auto const sine = std::sin(radians);
        std::vector<DetectedMarker> result;
        for (auto const& base : BaseMarkers) {
            if (missing && *missing == base.position) {
                continue;
            }
            auto const& placement = placementAt(*placements, base.position);
            auto const x = base.x - 500.0;
            auto const y = base.y - 500.0;
            result.push_back({
                placement.id,
                500.0 + x * cosine - y * sine,
                500.0 + x * sine + y * cosine,
                static_cast<double>((placement.rotation + pageRotation + 360) % 360),
            });
        }
        return result;
    }

    void testCodec()
    {
        assert(!MarkerPositioner::encodeVersion(0));
        assert(!MarkerPositioner::encodeVersion(65));

        for (std::uint32_t version = 1; version <= MarkerPositioner::LatestVersion; ++version) {
            auto const ids = MarkerPositioner::encodeVersion(version);
            assert(ids);

            std::array<std::optional<std::uint32_t>, 4> optionalIds{
                (*ids)[0], (*ids)[1], (*ids)[2], (*ids)[3]};
            assert(MarkerPositioner::decodeVersion(optionalIds) == version);

            for (std::size_t missing = 0; missing < optionalIds.size(); ++missing) {
                auto withMissing = optionalIds;
                withMissing[missing] = std::nullopt;
                assert(MarkerPositioner::decodeVersion(withMissing) == version);
            }
        }

        assert(!MarkerPositioner::decodeVersion({3, std::nullopt, std::nullopt, 3}));
        assert(!MarkerPositioner::decodeVersion({99, 3, 3, 3}));
        assert(!MarkerPositioner::decodeVersion({3, 3, 3, 5}));
    }

    void testCompactDictionary()
    {
        auto const& dictionary = SheetDictionary::value();
        std::cout << "Compact marker dictionary: inter-marker distance="
                  << SheetDictionary::minimumInterMarkerDistance()
                  << ", self-rotation distance="
                  << SheetDictionary::minimumSelfRotationDistance()
                  << ", correction bits="
                  << SheetDictionary::maximumCorrectionBits() << '\n';
        assert(dictionary.bytesList.rows == 5);
        assert(dictionary.markerSize == 4);
        assert(dictionary.maxCorrectionBits
            == SheetDictionary::maximumCorrectionBits());
        assert(SheetDictionary::minimumInterMarkerDistance() == 7);
        assert(SheetDictionary::minimumSelfRotationDistance() == 6);
        assert(SheetDictionary::minimumHammingDistance() == 7);
        assert(SheetDictionary::maximumCorrectionBits() == 3);
        assert(dictionary.maxCorrectionBits
            == (SheetDictionary::minimumHammingDistance() - 1) / 2);

        constexpr std::array canonicalIds{3U, 5U, 25U, 26U, 31U};
        for (std::size_t index = 0; index < canonicalIds.size(); ++index) {
            assert(SheetDictionary::localId(canonicalIds[index])
                == static_cast<int>(index));
            assert(SheetDictionary::canonicalId(static_cast<int>(index))
                == canonicalIds[index]);
        }
        assert(!SheetDictionary::localId(4));
        assert(!SheetDictionary::canonicalId(-1));
        assert(!SheetDictionary::canonicalId(5));

        auto const source = cv::aruco::getPredefinedDictionary(
            cv::aruco::DICT_4X4_50);
        for (std::size_t local = 0; local < canonicalIds.size(); ++local) {
            cv::Mat compactMarker;
            cv::Mat sourceMarker;
            dictionary.generateImageMarker(
                static_cast<int>(local), 120, compactMarker, 1);
            source.generateImageMarker(
                static_cast<int>(canonicalIds[local]), 120, sourceMarker, 1);
            assert(cv::countNonZero(compactMarker != sourceMarker) == 0);

            cv::Mat original;
            dictionary.getMarkerBits(static_cast<int>(local), 0)
                .convertTo(original, CV_8U);
            for (int first = 0; first < 16; ++first) {
                auto oneBit = original.clone();
                oneBit.at<std::uint8_t>(first / 4, first % 4) ^= 1U;
                int identified = -1;
                int rotation = -1;
                assert(dictionary.identify(oneBit, identified, rotation, 1.0));
                assert(identified == static_cast<int>(local));

                for (int second = first + 1; second < 16; ++second) {
                    auto twoBits = oneBit.clone();
                    twoBits.at<std::uint8_t>(second / 4, second % 4) ^= 1U;
                    identified = -1;
                    rotation = -1;
                    assert(dictionary.identify(
                        twoBits, identified, rotation, 1.0));
                    assert(identified == static_cast<int>(local));
                    for (int third = second + 1; third < 16; ++third) {
                        auto threeBits = twoBits.clone();
                        threeBits.at<std::uint8_t>(third / 4, third % 4) ^= 1U;
                        identified = -1;
                        rotation = -1;
                        assert(dictionary.identify(
                            threeBits, identified, rotation, 1.0));
                        assert(identified == static_cast<int>(local));
                    }
                }
            }
        }
    }

    void testPlacementsAndPositioning()
    {
        constexpr std::array rotations{0, 90, 180, 270};
        constexpr std::array positions{
            MarkerPosition::TL,
            MarkerPosition::TR,
            MarkerPosition::BR,
            MarkerPosition::BL,
            MarkerPosition::FB,
        };

        for (std::uint32_t version = 1; version <= MarkerPositioner::LatestVersion; ++version) {
            auto const placements = MarkerPositioner::placements(version);
            assert(placements);
            assert((*placements)[0].rotation == 90);
            assert((*placements)[2].rotation == 180);
            assert((*placements)[4].id == MarkerPositioner::FixedBottomId);

            for (auto const rotation : rotations) {
                for (auto const missing : positions) {
                    auto markers = makeDetected(version, rotation, missing);
                    std::sort(markers.begin(), markers.end(), [](auto const& a, auto const& b) {
                        if (a.id != b.id) return a.id < b.id;
                        return a.centerX < b.centerX;
                    });

                    do {
                        auto const result = MarkerPositioner::position(markers);
                        assert(result);
                        assert(result->version == version);
                        assert(result->markers.size() == 4);

                        for (auto const& positioned : result->markers) {
                            assert(positioned.position != missing);
                            auto const& expected = placementAt(*placements, positioned.position);
                            assert(positioned.marker.id == expected.id);
                        }
                    } while (std::next_permutation(
                        markers.begin(), markers.end(), [](auto const& a, auto const& b) {
                            if (a.id != b.id) return a.id < b.id;
                            if (a.centerX != b.centerX) return a.centerX < b.centerX;
                            return a.centerY < b.centerY;
                        }));
                }
            }
        }
    }
}

int main()
{
    testCodec();
    testCompactDictionary();
    testPlacementsAndPositioning();
    std::cout << "Marker positioner tests passed\n";
}
