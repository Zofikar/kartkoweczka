#pragma once

#include <opencv2/opencv.hpp>

#include <optional>
#include <array>
#include <string>
#include <tuple>
#include <vector>

#include <openOmr/marker_positioner.h>

namespace OpenOmr
{
    struct Point
    {
        uint32_t x{}, y{};

        Point &operator+=(cv::Rect const & roi)
        {
            this->x += static_cast<uint32_t>(roi.x);
            this->y += static_cast<uint32_t>(roi.y);
            return *this;
        }
    };
    struct QrDetection
    {
        std::string data{}; // bytes as string
        Point tl{}, tr{}, br{}, bl{};
    };
    using RevisionId = std::array<std::uint8_t, 16>;
    struct RevisionDetection
    {
        RevisionId revisionId{};
        Point tl{}, tr{}, br{}, bl{};
    };
    struct ArUcoDetection
    {
        uint32_t id{};
        Point tl{}, tr{}, br{}, bl{};
    };
    cv::Mat generateQr(std::string const& data, cv::Size const& size);
    std::vector<QrDetection> detectQrCode(cv::Mat const& image, std::optional<cv::Rect> hintRoi = std::nullopt);


    enum class ImageQuality
    {
        Good,
        TooDark,
        TooBright,
    };
    ImageQuality checkImageQuality(cv::Mat const& image);


    class SheetGenerator
    {
    public:
        // revisionId must be a 16-byte RFC 4122 UUIDv4 or UUIDv7.
        void initialize(cv::Size, std::vector<std::uint8_t> revisionId);
        // Native/test entry point. The WebAssembly contract only exposes
        // initialize(), which always selects the latest version.
        bool initializeForVersion(cv::Size, std::vector<std::uint8_t> revisionId,
            uint32_t version);
        // Installs caller-provided TrueType/OpenType font bytes. Empty input
        // restores the embedded, build-pinned Google Fonts Roboto default.
        bool setFont(std::vector<uint8_t> fontData);
        bool addQuestion(uint32_t questionNumber, uint32_t subQuestionNumber,
            std::vector<std::string> answerLabels);
        cv::Mat generate();
        [[nodiscard]] uint32_t version() const noexcept;
        [[nodiscard]] std::size_t questionCount() const noexcept;
    private:
        cv::Size m_size{};
        RevisionId m_revisionId{};
        std::vector<uint8_t> m_fontData{};
        uint32_t m_version{};
        std::vector<std::tuple<uint32_t, uint32_t,
            std::vector<std::string>>> m_questions{};
        bool m_initialized{};
    };

    class SheetGrader
    {
    public:
        std::vector<ArUcoDetection> detectAruco(cv::Mat const& image);
        bool normalize(cv::Size sheetOriginalSize);
        std::optional<RevisionDetection> detectRevisionId();
        std::vector<uint8_t> gradeSheet(cv::Size cellSize, cv::Size innerCellSize);
        [[nodiscard]] std::optional<uint32_t> detectedVersion() const noexcept;
        [[nodiscard]] cv::Mat const& normalizedImage() const noexcept;

    private:
        cv::Mat m_source{};
        cv::Mat m_normalized{};
        std::vector<ArUcoDetection> m_aruco{};
        std::vector<DetectedMarker> m_detectedMarkers{};
        std::optional<PositionedSheet> m_positioned{};
    };

};