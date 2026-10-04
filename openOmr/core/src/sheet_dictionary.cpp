#include <openOmr/sheet_dictionary.h>

#include <openOmr/marker_positioner.h>

#include <opencv2/objdetect/aruco_dictionary.hpp>

#include <algorithm>
#include <array>
#include <limits>

namespace OpenOmr::SheetDictionary
{
    namespace
    {
        constexpr std::array CanonicalIds{
            MarkerPositioner::CornerIds[0],
            MarkerPositioner::CornerIds[1],
            MarkerPositioner::CornerIds[2],
            MarkerPositioner::CornerIds[3],
            MarkerPositioner::FixedBottomId,
        };

        int hammingDistance(cv::Mat const& left, cv::Mat const& right)
        {
            cv::Mat differences;
            cv::compare(left, right, differences, cv::CMP_NE);
            return cv::countNonZero(differences);
        }

        struct DistanceMetrics
        {
            int interMarker = std::numeric_limits<int>::max();
            int selfRotation = std::numeric_limits<int>::max();
        };

        DistanceMetrics deriveDistances(cv::aruco::Dictionary const& dictionary)
        {
            DistanceMetrics result;
            for (int leftId = 0; leftId < dictionary.bytesList.rows; ++leftId) {
                for (int leftRotation = 0; leftRotation < 4; ++leftRotation) {
                    auto const left = dictionary.getMarkerBits(leftId, leftRotation);
                    for (int rightId = leftId; rightId < dictionary.bytesList.rows; ++rightId) {
                        for (int rightRotation = 0; rightRotation < 4; ++rightRotation) {
                            if (leftId == rightId && leftRotation == rightRotation) continue;
                            auto const right = dictionary.getMarkerBits(rightId, rightRotation);
                            auto const distance = hammingDistance(left, right);
                            if (leftId == rightId) {
                                result.selfRotation = std::min(
                                    result.selfRotation, distance);
                            } else {
                                result.interMarker = std::min(
                                    result.interMarker, distance);
                            }
                        }
                    }
                }
            }
            return result;
        }

        struct DictionaryData
        {
            cv::aruco::Dictionary dictionary;
            DistanceMetrics distances;
        };

        DictionaryData const& data()
        {
            static DictionaryData const instance = [] {
                auto const source = cv::aruco::getPredefinedDictionary(
                    cv::aruco::DICT_4X4_50);
                cv::Mat bytes(
                    static_cast<int>(CanonicalIds.size()),
                    source.bytesList.cols,
                    source.bytesList.type());
                for (std::size_t local = 0; local < CanonicalIds.size(); ++local) {
                    source.bytesList.row(static_cast<int>(CanonicalIds[local]))
                        .copyTo(bytes.row(static_cast<int>(local)));
                }

                cv::aruco::Dictionary dictionary(bytes, source.markerSize, 0);
                auto const distances = deriveDistances(dictionary);
                // OpenCV's dictionary distance is the minimum between
                // different marker IDs while considering every rotation.
                // Rotations of the same ID are intentionally excluded.
                dictionary.maxCorrectionBits = std::max(
                    0, (distances.interMarker - 1) / 2);
                return DictionaryData{std::move(dictionary), distances};
            }();
            return instance;
        }
    }

    cv::aruco::Dictionary const& value()
    {
        return data().dictionary;
    }

    std::optional<int> localId(std::uint32_t canonical) noexcept
    {
        auto const found = std::ranges::find(CanonicalIds, canonical);
        if (found == CanonicalIds.end()) return std::nullopt;
        return static_cast<int>(std::distance(CanonicalIds.begin(), found));
    }

    std::optional<std::uint32_t> canonicalId(int local) noexcept
    {
        if (local < 0 || local >= static_cast<int>(CanonicalIds.size())) {
            return std::nullopt;
        }
        return CanonicalIds[static_cast<std::size_t>(local)];
    }

    int minimumHammingDistance() noexcept
    {
        return data().distances.interMarker;
    }

    int minimumInterMarkerDistance() noexcept
    {
        return data().distances.interMarker;
    }

    int minimumSelfRotationDistance() noexcept
    {
        return data().distances.selfRotation;
    }

    int maximumCorrectionBits() noexcept
    {
        return data().dictionary.maxCorrectionBits;
    }
}