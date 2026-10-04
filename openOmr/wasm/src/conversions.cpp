#include <openOmrWasm/conversions.h>

#include <stdexcept>

namespace OpenOmrWasm::WASM2CPP
{
    std::string Convert(std::vector<std::uint8_t> const& value)
    {
        return {reinterpret_cast<char const*>(value.data()), value.size()};
    }

    std::vector<std::uint8_t> ConvertBytes(emscripten::val const& value)
    {
        auto const length = value["length"].as<std::size_t>();
        std::vector<std::uint8_t> result(length);
        for (std::size_t index = 0; index < length; ++index) {
            result[index] = value[index].as<std::uint8_t>();
        }
        return result;
    }

    std::vector<std::string> Convert(
        std::vector<std::vector<std::uint8_t>> const& value)
    {
        std::vector<std::string> result;
        result.reserve(value.size());
        for (auto const& item : value) result.push_back(Convert(item));
        return result;
    }

    std::vector<std::string> ConvertByteStrings(emscripten::val const& value)
    {
        auto const count = value["length"].as<std::size_t>();
        std::vector<std::string> result;
        result.reserve(count);
        for (std::size_t index = 0; index < count; ++index) {
            auto const bytes = value[index];
            auto const length = bytes["length"].as<std::size_t>();
            std::string label(length, '\0');
            for (std::size_t byte = 0; byte < length; ++byte) {
                label[byte] = static_cast<char>(bytes[byte].as<std::uint8_t>());
            }
            result.push_back(std::move(label));
        }
        return result;
    }

    cv::Size Convert(Size const& value)
    {
        return {static_cast<int>(value.width), static_cast<int>(value.height)};
    }

    cv::Rect Convert(View const& value)
    {
        return {
            static_cast<int>(value.x), static_cast<int>(value.y),
            static_cast<int>(value.width), static_cast<int>(value.height)};
    }

    std::optional<cv::Rect> Convert(std::optional<View> const& value)
    {
        if (!value) return std::nullopt;
        return Convert(*value);
    }

    cv::Mat Convert(Image const& value)
    {
        if (value.width == 0 || value.height == 0) return {};
        auto const channels = value.layout == PixelLayout::Gray ? 1U : 4U;
        auto const expected = static_cast<std::size_t>(value.width)
            * value.height * channels;
        if (value.data.size() != expected) {
            throw std::invalid_argument(
                "Image.data length does not match dimensions/layout");
        }
        cv::Mat view(
            static_cast<int>(value.height), static_cast<int>(value.width),
            channels == 1 ? CV_8UC1 : CV_8UC4,
            const_cast<std::uint8_t*>(value.data.data()));
        return view.clone();
    }
}

namespace OpenOmrWasm::CPP2WASM
{
    std::vector<std::uint8_t> Convert(std::string const& value)
    {
        return {value.begin(), value.end()};
    }

    Image Convert(cv::Mat const& input)
    {
        if (input.empty()) return {};
        cv::Mat image = input.isContinuous() ? input : input.clone();
        PixelLayout layout{};
        if (image.type() == CV_8UC1) {
            layout = PixelLayout::Gray;
        } else if (image.type() == CV_8UC4) {
            layout = PixelLayout::RGBA;
        } else if (image.type() == CV_8UC3) {
            cv::cvtColor(image, image, cv::COLOR_BGR2RGBA);
            layout = PixelLayout::RGBA;
        } else {
            throw std::invalid_argument("unsupported cv::Mat type for Wasm Image");
        }
        auto const byteCount = image.total() * image.elemSize();
        return {
            std::vector<std::uint8_t>(image.data, image.data + byteCount),
            static_cast<std::uint32_t>(image.cols),
            static_cast<std::uint32_t>(image.rows),
            layout,
        };
    }

    Point Convert(OpenOmr::Point const& value)
    {
        return {value.x, value.y};
    }

    QrDetection Convert(OpenOmr::QrDetection const& value)
    {
        return {
            Convert(value.data), Convert(value.tl), Convert(value.tr),
            Convert(value.bl), Convert(value.br)};
    }

    RevisionDetection Convert(OpenOmr::RevisionDetection const& value)
    {
        return {
            std::vector<std::uint8_t>(
                value.revisionId.begin(), value.revisionId.end()),
            Convert(value.tl), Convert(value.tr),
            Convert(value.bl), Convert(value.br)};
    }

    ArucoDetection Convert(OpenOmr::ArUcoDetection const& value)
    {
        return {
            value.id, Convert(value.tl), Convert(value.tr),
            Convert(value.bl), Convert(value.br)};
    }

    ImageQuality Convert(OpenOmr::ImageQuality value)
    {
        switch (value) {
        case OpenOmr::ImageQuality::TooDark: return ImageQuality::TooDark;
        case OpenOmr::ImageQuality::TooBright: return ImageQuality::TooBright;
        default: return ImageQuality::Good;
        }
    }

    std::vector<QrDetection> Convert(
        std::vector<OpenOmr::QrDetection> const& value)
    {
        std::vector<QrDetection> result;
        result.reserve(value.size());
        for (auto const& item : value) result.push_back(Convert(item));
        return result;
    }

    std::vector<ArucoDetection> Convert(
        std::vector<OpenOmr::ArUcoDetection> const& value)
    {
        std::vector<ArucoDetection> result;
        result.reserve(value.size());
        for (auto const& item : value) result.push_back(Convert(item));
        return result;
    }

    std::optional<QrDetection> Convert(
        std::optional<OpenOmr::QrDetection> const& value)
    {
        if (!value) return std::nullopt;
        return Convert(*value);
    }

    std::optional<RevisionDetection> Convert(
        std::optional<OpenOmr::RevisionDetection> const& value)
    {
        if (!value) return std::nullopt;
        return Convert(*value);
    }
}