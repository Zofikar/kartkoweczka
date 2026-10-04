#pragma once

#include <cstdint>
#include <vector>

inline std::vector<std::uint8_t> testRevisionId(std::uint32_t seed)
{
    std::vector<std::uint8_t> result(16);
    for (std::size_t index = 0; index < result.size(); ++index) {
        result[index] = static_cast<std::uint8_t>(seed * 17U + index);
    }
    result[6] = static_cast<std::uint8_t>((result[6] & 0x0fU) | 0x70U);
    result[8] = static_cast<std::uint8_t>((result[8] & 0x3fU) | 0x80U);
    return result;
}