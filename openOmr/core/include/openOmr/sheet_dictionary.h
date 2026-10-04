#pragma once

#include <opencv2/objdetect/aruco_dictionary.hpp>

#include <cstdint>
#include <optional>

namespace OpenOmr::SheetDictionary
{
    // A compact dictionary containing only canonical DICT_4X4_50 markers
    // 3, 5, 25, 26, and 31. OpenCV addresses its rows as local IDs 0..4;
    // the conversion helpers keep those implementation IDs out of the domain.
    cv::aruco::Dictionary const& value();
    std::optional<int> localId(std::uint32_t canonicalId) noexcept;
    std::optional<std::uint32_t> canonicalId(int localId) noexcept;
    int minimumInterMarkerDistance() noexcept;
    int minimumSelfRotationDistance() noexcept;
    int minimumHammingDistance() noexcept;
    int maximumCorrectionBits() noexcept;
}