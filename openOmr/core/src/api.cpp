#include <openOmr/api.h>
#include <openOmr/marker_positioner.h>
#include <openOmr/sheet_dictionary.h>
#include <openOmr/sheet_config.h>

#include "default_font.h"

#include <opencv2/freetype.hpp>
#include <opencv2/objdetect/aruco_detector.hpp>

#include <algorithm>
#include <array>
#include <cmath>
#include <functional>
#include <limits>
#include <stdexcept>

namespace OpenOmr
{
    namespace
    {
        Point ConvertPoint(cv::Point2f const& in)
        {
            return Point{
                .x = static_cast<uint32_t>(std::round(in.x)),
                .y = static_cast<uint32_t>(std::round(in.y))
            };
        }
    }

    cv::Mat generateQr(std::string const& data, cv::Size const& size)
    {
        if (data.empty() || size.width <= 0 || size.height <= 0) {
            return {};
        }
        cv::QRCodeEncoder::Params params;
        params.mode = cv::QRCodeEncoder::EncodeMode::MODE_BYTE;
        params.correction_level = cv::QRCodeEncoder::CorrectionLevel::CORRECT_LEVEL_M;
        cv::Ptr<cv::QRCodeEncoder> encoder = cv::QRCodeEncoder::create(params);
        cv::Mat qrMat;
        encoder->encode(data, qrMat);
        if (qrMat.empty()) {
            return {};
        }
        // QR requires a quiet zone of at least four modules. Preserve it
        // explicitly because the encoder output itself is tightly cropped.
        cv::Mat withQuietZone;
        cv::copyMakeBorder(
            qrMat, withQuietZone, 4, 4, 4, 4,
            cv::BORDER_CONSTANT, cv::Scalar(255));
        cv::Mat qrVisual;
        cv::resize(withQuietZone, qrVisual, size, 0, 0, cv::INTER_NEAREST);

        return qrVisual;
    }

    std::vector<QrDetection> detectQrCode(cv::Mat const& image, std::optional<cv::Rect> hintRoi)
    {
        if (hintRoi) {
            cv::Rect roi = hintRoi.value() & cv::Rect(0, 0, image.cols, image.rows);

            if (roi.width > 0 && roi.height > 0) {
                cv::Mat cropped = image(roi);
                auto result = detectQrCode(cropped);
                if (!result.empty()) {

                    for (auto& res : result) {
                        res.tl += roi;
                        res.tr += roi;
                        res.bl += roi;
                        res.br += roi;
                    }

                    return result;
                }
            }
        }


        cv::QRCodeDetectorAruco detector;
        std::vector<cv::Point2f> points;

        if (!detector.detectMulti(image, points) || points.empty()) {
            return std::vector<QrDetection>{};
        }

        size_t const count = points.size() / 4;

        std::vector<QrDetection> result;
        result.reserve(count);
        for (size_t i = 0; i < count; i++) {
            cv::Mat cornerSlice(4, 1, CV_32FC2, const_cast<cv::Point2f*>(&points[i * 4]));
            auto data = detector.decode(image, cornerSlice);
            if (data.empty()) {
                continue;
            }
            result.emplace_back(QrDetection{
                .data = std::move(data),
                .tl = ConvertPoint(points[i * 4]),
                .tr = ConvertPoint(points[i * 4+1]),
                .br = ConvertPoint(points[i * 4+2]),
                .bl = ConvertPoint(points[i * 4+3]),
            });
        }
        return result;
    }

    ImageQuality checkImageQuality(cv::Mat const& image)
    {
        if (image.empty()) {
            return ImageQuality::TooDark;
        }
        cv::Mat gray;
        if (image.channels() == 1) gray = image;
        else if (image.channels() == 4) cv::cvtColor(image, gray, cv::COLOR_RGBA2GRAY);
        else if (image.channels() == 3) cv::cvtColor(image, gray, cv::COLOR_BGR2GRAY);
        else return ImageQuality::TooDark;

        auto const mean = cv::mean(gray)[0];
        cv::Mat darkPixels;
        cv::Mat brightPixels;
        cv::compare(gray, 24, darkPixels, cv::CMP_LE);
        cv::compare(gray, 231, brightPixels, cv::CMP_GE);
        auto const total = static_cast<double>(gray.total());
        auto const darkRatio = cv::countNonZero(darkPixels) / total;
        auto const brightRatio = cv::countNonZero(brightPixels) / total;

        if (mean < 55.0 || darkRatio > 0.85) return ImageQuality::TooDark;
        if (mean > 245.0 || brightRatio > 0.97) return ImageQuality::TooBright;
        return ImageQuality::Good;
    }

    namespace
    {
        using Question = std::tuple<std::uint32_t, std::uint32_t,
            std::vector<std::string>>;

        struct QuestionBlock
        {
            std::size_t firstQuestion{};
            std::size_t questionCount{};
            std::uint32_t answerCount{};
            int x{};
        };

        std::optional<std::vector<QuestionBlock>> planQuestionBlocks(
            SheetVersionConfig const& config,
            std::vector<Question> const& questions)
        {
            std::vector<QuestionBlock> blocks;
            auto const rowsPerBlock = config.gridArea.height / config.cellSize.height;
            if (rowsPerBlock <= 0) return std::nullopt;
            auto x = config.gridArea.x;
            for (std::size_t first = 0; first < questions.size();
                 first += static_cast<std::size_t>(rowsPerBlock)) {
                auto const count = std::min<std::size_t>(
                    static_cast<std::size_t>(rowsPerBlock), questions.size() - first);
                std::uint32_t answerCount = 0;
                for (std::size_t index = first; index < first + count; ++index) {
                    answerCount = std::max(answerCount,
                        static_cast<std::uint32_t>(std::get<2>(questions[index]).size()));
                }
                auto const width = static_cast<int>(answerCount + 1U)
                    * config.cellSize.width;
                if (x + width > config.gridArea.br().x) return std::nullopt;
                blocks.push_back({first, count, answerCount, x});
                x += width + config.questionColumnGutter;
            }
            return blocks;
        }
    }

    namespace
    {
        constexpr char RevisionPayloadVersion = '1';
        constexpr std::string_view Base64UrlAlphabet =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

        bool validRevisionId(std::vector<std::uint8_t> const& value)
        {
            if (value.size() != 16) return false;
            auto const version = value[6] >> 4U;
            return (version == 4 || version == 7)
                && (value[8] & 0xc0U) == 0x80U;
        }

        std::string revisionPayload(RevisionId const& revisionId)
        {
            std::string result(1, RevisionPayloadVersion);
            std::uint32_t buffer = 0;
            int bits = 0;
            for (auto const byte : revisionId) {
                buffer = (buffer << 8U) | byte;
                bits += 8;
                while (bits >= 6) {
                    bits -= 6;
                    result.push_back(Base64UrlAlphabet[(buffer >> bits) & 0x3fU]);
                }
            }
            if (bits > 0) {
                result.push_back(Base64UrlAlphabet[(buffer << (6 - bits)) & 0x3fU]);
            }
            return result;
        }

        std::optional<RevisionId> parseRevisionPayload(std::string const& payload)
        {
            if (payload.size() != 23 || payload[0] != RevisionPayloadVersion) {
                return std::nullopt;
            }
            RevisionId result{};
            std::uint32_t buffer = 0;
            int bits = 0;
            std::size_t output = 0;
            for (auto const character : std::string_view(payload).substr(1)) {
                auto const position = Base64UrlAlphabet.find(character);
                if (position == std::string_view::npos) return std::nullopt;
                buffer = (buffer << 6U) | static_cast<std::uint32_t>(position);
                bits += 6;
                if (bits >= 8) {
                    bits -= 8;
                    if (output >= result.size()) return std::nullopt;
                    result[output++] = static_cast<std::uint8_t>(buffer >> bits);
                }
            }
            if (output != result.size()) return std::nullopt;
            std::vector<std::uint8_t> bytes(result.begin(), result.end());
            if (!validRevisionId(bytes)) return std::nullopt;
            return result;
        }
    }

    void SheetGenerator::initialize(
        cv::Size size, std::vector<std::uint8_t> revisionId)
    {
        if (!initializeForVersion(size, std::move(revisionId), MarkerPositioner::LatestVersion)) {
            throw std::invalid_argument("invalid sheet generator configuration");
        }
    }

    bool SheetGenerator::initializeForVersion(
        cv::Size size,
        std::vector<std::uint8_t> revisionId,
        uint32_t version)
    {
        auto const config = sheetVersionConfig(version);
        if (!config || size.width <= 0 || size.height <= 0
            || !validRevisionId(revisionId)) {
            return false;
        }
        m_size = size;
        std::copy(revisionId.begin(), revisionId.end(), m_revisionId.begin());
        m_version = version;
        m_questions.clear();
        m_initialized = true;
        return true;
    }

    bool SheetGenerator::setFont(std::vector<uint8_t> fontData)
    {
        if (fontData.empty()) {
            m_fontData.clear();
            return true;
        }
        constexpr std::size_t minimumSfntBytes = 12;
        constexpr std::size_t maximumFontBytes = 32U * 1024U * 1024U;
        if (fontData.size() < minimumSfntBytes
            || fontData.size() > maximumFontBytes) {
            return false;
        }
        try {
            auto font = cv::freetype::createFreeType2();
            font->loadFontData(
                reinterpret_cast<char*>(fontData.data()), fontData.size(), 0);
        } catch (cv::Exception const&) {
            return false;
        }
        m_fontData = std::move(fontData);
        return true;
    }

    bool SheetGenerator::addQuestion(
        uint32_t questionNumber,
        uint32_t subQuestionNumber,
        std::vector<std::string> answerLabels)
    {
        auto const config = sheetVersionConfig(m_version);
        auto const validLabel = [](std::string const& label) {
            return !label.empty() && label.size() <= 3
                && std::ranges::all_of(label, [](unsigned char value) {
                    return value >= 'A' && value <= 'Z';
                });
        };
        if (!m_initialized || !config || answerLabels.empty()
            || answerLabels.size() > config->maxAnswerCount
            || !std::ranges::all_of(answerLabels, validLabel)) {
            return false;
        }
        auto const duplicate = std::ranges::any_of(
            m_questions,
            [=](auto const& question) {
                return std::get<0>(question) == questionNumber
                    && std::get<1>(question) == subQuestionNumber;
            });
        if (duplicate) {
            return false;
        }
        auto prospective = m_questions;
        prospective.emplace_back(
            questionNumber, subQuestionNumber, std::move(answerLabels));
        if (!planQuestionBlocks(*config, prospective)) return false;
        m_questions = std::move(prospective);
        return true;
    }

    namespace
    {
        cv::Point scalePoint(cv::Point point, cv::Size from, cv::Size to)
        {
            return {
                static_cast<int>(std::lround(point.x * static_cast<double>(to.width) / from.width)),
                static_cast<int>(std::lround(point.y * static_cast<double>(to.height) / from.height)),
            };
        }

        cv::Size scaleSize(cv::Size value, cv::Size from, cv::Size to)
        {
            return {
                std::max(1, static_cast<int>(std::lround(value.width * static_cast<double>(to.width) / from.width))),
                std::max(1, static_cast<int>(std::lround(value.height * static_cast<double>(to.height) / from.height))),
            };
        }

        cv::Rect centeredRect(cv::Point center, cv::Size size)
        {
            return {center.x - size.width / 2, center.y - size.height / 2, size.width, size.height};
        }

        cv::Mat rotatedMarker(cv::Mat marker, std::uint16_t rotation)
        {
            cv::Mat result;
            switch (rotation) {
            case 90: cv::rotate(marker, result, cv::ROTATE_90_CLOCKWISE); break;
            case 180: cv::rotate(marker, result, cv::ROTATE_180); break;
            case 270: cv::rotate(marker, result, cv::ROTATE_90_COUNTERCLOCKWISE); break;
            default: result = marker; break;
            }
            return result;
        }
    }

    cv::Mat SheetGenerator::generate()
    {
        auto const config = sheetVersionConfig(m_version);
        auto const placementsValue = MarkerPositioner::placements(m_version);
        if (!m_initialized || !config || !placementsValue) {
            return {};
        }

        cv::Mat sheet(m_size, CV_8UC1, cv::Scalar(255));
        auto const& dictionary = SheetDictionary::value();
        auto const markerSize = scaleSize(
            {config->markerSize, config->markerSize}, config->referenceSize, m_size);
        auto const squareMarkerSize = std::min(markerSize.width, markerSize.height);

        auto const guideInset = scalePoint(
            {config->guideInset, config->guideInset}, config->referenceSize, m_size);
        auto const guideEnd = scalePoint(
            {config->guideInset + config->guideLength,
                config->guideInset + config->guideLength},
            config->referenceSize, m_size);
        auto const guideRight = m_size.width - guideInset.x;
        auto const guideBottom = m_size.height - guideInset.y;
        auto const guideThickness = std::max(1, scaleSize(
            {config->guideThickness, config->guideThickness},
            config->referenceSize, m_size).width);
        auto drawGuide = [&](cv::Point corner, cv::Point horizontalEnd,
                             cv::Point verticalEnd) {
            cv::line(sheet, corner, horizontalEnd, cv::Scalar(0), guideThickness);
            cv::line(sheet, corner, verticalEnd, cv::Scalar(0), guideThickness);
        };
        drawGuide(
            guideInset,
            {guideEnd.x, guideInset.y},
            {guideInset.x, guideEnd.y});
        drawGuide(
            {guideRight, guideInset.y},
            {m_size.width - guideEnd.x, guideInset.y},
            {guideRight, guideEnd.y});
        drawGuide(
            {guideRight, guideBottom},
            {m_size.width - guideEnd.x, guideBottom},
            {guideRight, m_size.height - guideEnd.y});
        drawGuide(
            {guideInset.x, guideBottom},
            {guideEnd.x, guideBottom},
            {guideInset.x, m_size.height - guideEnd.y});

        for (auto const& placement : *placementsValue) {
            auto const markerId = SheetDictionary::localId(placement.id);
            if (!markerId) return {};
            cv::Mat marker;
            cv::aruco::generateImageMarker(
                dictionary, *markerId, squareMarkerSize, marker, 1);
            marker = rotatedMarker(marker, placement.rotation);
            auto const center = scalePoint(markerCenter(*config, placement.position), config->referenceSize, m_size);
            auto const target = centeredRect(center, marker.size()) & cv::Rect({}, m_size);
            if (target.size() != marker.size()) {
                return {};
            }
            marker.copyTo(sheet(target));
        }

        cv::Mat qr = generateQr(
            revisionPayload(m_revisionId), config->identityCodeArea.size());
        if (qr.empty()) {
            return {};
        }
        auto const qrTopLeft = scalePoint(
            config->identityCodeArea.tl(), config->referenceSize, m_size);
        auto const qrSize = scaleSize(
            config->identityCodeArea.size(), config->referenceSize, m_size);
        cv::resize(qr, qr, qrSize, 0, 0, cv::INTER_NEAREST);
        auto const qrTarget = cv::Rect(qrTopLeft, qrSize) & cv::Rect({}, m_size);
        if (qrTarget.size() != qrSize) {
            return {};
        }
        qr.copyTo(sheet(qrTarget));

        auto const cell = scaleSize(config->cellSize, config->referenceSize, m_size);
        auto const gridTopLeft = scalePoint(
            config->gridArea.tl(), config->referenceSize, m_size);
        auto const inner = scaleSize(
            innerSquareSize(*config), config->referenceSize, m_size);
        auto const innerThickness = std::max(1, scaleSize(
            {config->innerSquareThickness, config->innerSquareThickness},
            config->referenceSize, m_size).width);
        auto const blocks = planQuestionBlocks(*config, m_questions);
        if (!blocks) return {};
        cv::Ptr<cv::freetype::FreeType2> trueTypeFont;
        try {
            trueTypeFont = cv::freetype::createFreeType2();
            auto* fontBytes = m_fontData.empty()
                ? Resources::DefaultFont
                : m_fontData.data();
            auto const fontSize = m_fontData.empty()
                ? Resources::DefaultFontSize
                : m_fontData.size();
            trueTypeFont->loadFontData(
                reinterpret_cast<char*>(fontBytes), fontSize, 0);
        } catch (cv::Exception const&) {
            return {};
        }
        auto renderTrueTypeInk = [&](std::string const& text,
                                     int pixelHeight) -> cv::Mat {
            if (!trueTypeFont) return {};
            int baseline = 0;
            auto const metrics = trueTypeFont->getTextSize(
                text, pixelHeight, -1, &baseline);
            auto const padding = std::max(16, pixelHeight * 2);
            cv::Mat probe(
                std::max(1, metrics.height + std::abs(baseline) + 4 * padding),
                std::max(1, metrics.width + 4 * padding),
                CV_8UC1, cv::Scalar(255));
            trueTypeFont->putText(
                probe, text, {2 * padding, 2 * padding}, pixelHeight,
                cv::Scalar(0), -1, cv::LINE_AA, false);

            cv::Mat inkMask;
            cv::threshold(probe, inkMask, 254, 255, cv::THRESH_BINARY_INV);
            std::vector<cv::Point> inkPoints;
            cv::findNonZero(inkMask, inkPoints);
            if (inkPoints.empty()) return {};
            return probe(cv::boundingRect(inkPoints)).clone();
        };
        auto drawTrueType = [&](std::string const& text, cv::Point center,
                                cv::Size box, int maxPixelHeight) {
            if (!trueTypeFont) return false;
            auto low = 1;
            auto high = std::max(1, maxPixelHeight);
            for (int iteration = 0; iteration < 12; ++iteration) {
                auto const pixelHeight = (low + high + 1) / 2;
                auto const candidate = renderTrueTypeInk(text, pixelHeight);
                if (!candidate.empty()
                    && candidate.cols <= box.width
                    && candidate.rows <= box.height) {
                    low = pixelHeight;
                } else {
                    high = pixelHeight - 1;
                }
            }
            auto const glyph = renderTrueTypeInk(text, low);
            if (glyph.empty() || glyph.cols > box.width || glyph.rows > box.height) {
                return false;
            }
            auto const target = centeredRect(center, glyph.size());
            if ((target & cv::Rect({}, sheet.size())) != target) return false;
            cv::Mat targetView = sheet(target);
            cv::min(targetView, glyph, targetView);
            return true;
        };
        auto drawFittedText = [&](std::string const& text, cv::Point center,
                                  cv::Size box, int thickness) {
            if (drawTrueType(text, center,
                    {std::max(1, box.width - 8), std::max(1, box.height - 8)},
                    24)) return;
            // Find the largest readable label that retains a small inset from
            // the target frame. This gives single-character A-H/T/F labels a
            // substantially larger print size while still supporting short
            // multi-character labels.
            auto const availableWidth = std::max(1, box.width - 8);
            auto const availableHeight = std::max(1, box.height - 8);
            double low = 0.1;
            double high = 2.0;
            for (int iteration = 0; iteration < 12; ++iteration) {
                auto const candidate = (low + high) / 2.0;
                int baseline = 0;
                auto const extent = cv::getTextSize(
                    text, cv::FONT_HERSHEY_SIMPLEX, candidate, thickness,
                    &baseline);
                if (extent.width <= availableWidth
                    && extent.height + baseline <= availableHeight) {
                    low = candidate;
                } else {
                    high = candidate;
                }
            }
            // Answer labels are restricted to uppercase A-Z, so there are no
            // descenders or underscores. Center the visible cap-height box;
            // including OpenCV's baseline allowance would shift it upward.
            int baseline = 0;
            auto const extent = cv::getTextSize(
                text, cv::FONT_HERSHEY_SIMPLEX, low, thickness, &baseline);
            auto const origin = cv::Point{
                center.x - extent.width / 2,
                center.y + extent.height / 2};
            cv::putText(sheet, text, origin, cv::FONT_HERSHEY_SIMPLEX,
                low, cv::Scalar(0), thickness, cv::LINE_AA);
        };
        auto drawFittedQuestion = [&](std::string const& text,
                                      cv::Point center) {
            // Question identifiers may contain digits and a separator but no
            // descenders. Fit and center their visible height independently
            // from answer-target typography.
            auto const box = cv::Size{
                std::max(1, cell.width - 14),
                std::max(1, cell.height - 18)};
            if (drawTrueType(text, center, box, 30)) return;
            constexpr int thickness = 2;
            double low = 0.1;
            // Keep question identifiers only modestly larger than answer
            // letters. The cell itself is twice the target size, but using
            // all of it makes one-digit identifiers visually dominant.
            double high = 1.30;
            for (int iteration = 0; iteration < 12; ++iteration) {
                auto const candidate = (low + high) / 2.0;
                int baseline = 0;
                auto const extent = cv::getTextSize(
                    text, cv::FONT_HERSHEY_SIMPLEX, candidate, thickness,
                    &baseline);
                if (extent.width <= box.width && extent.height <= box.height) {
                    low = candidate;
                } else {
                    high = candidate;
                }
            }
            int baseline = 0;
            auto const extent = cv::getTextSize(
                text, cv::FONT_HERSHEY_SIMPLEX, low, thickness, &baseline);
            cv::putText(sheet, text,
                {center.x - extent.width / 2, center.y + extent.height / 2},
                cv::FONT_HERSHEY_SIMPLEX, low, cv::Scalar(0), thickness,
                cv::LINE_AA);
        };
        for (auto const& block : *blocks) {
            auto const blockX = scalePoint(
                {block.x, config->gridArea.y}, config->referenceSize, m_size).x;
            auto const columns = block.answerCount + 1U;
            auto const rows = static_cast<std::uint32_t>(block.questionCount);
            for (std::uint32_t column = 0; column <= columns; ++column) {
                auto const x = blockX + static_cast<int>(column) * cell.width;
                cv::line(sheet, {x, gridTopLeft.y},
                    {x, gridTopLeft.y + static_cast<int>(rows) * cell.height},
                    cv::Scalar(0), 3, cv::LINE_8);
            }
            for (std::uint32_t row = 0; row <= rows; ++row) {
                auto const y = gridTopLeft.y + static_cast<int>(row) * cell.height;
                cv::line(sheet, {blockX, y},
                    {blockX + static_cast<int>(columns) * cell.width, y},
                    cv::Scalar(0), 3, cv::LINE_8);
            }
            for (std::size_t row = 0; row < block.questionCount; ++row) {
                auto const& [questionNumber, subQuestionNumber, answerLabels]
                    = m_questions[block.firstQuestion + row];
                auto const y = gridTopLeft.y + static_cast<int>(row) * cell.height
                    + cell.height / 2;
                std::string label = std::to_string(questionNumber);
                if (subQuestionNumber != 0) label += "." + std::to_string(subQuestionNumber);
                drawFittedQuestion(label, {blockX + cell.width / 2, y});
                for (std::size_t answer = 0; answer < answerLabels.size(); ++answer) {
                    auto const center = cv::Point{
                        blockX + static_cast<int>(answer + 1U) * cell.width + cell.width / 2,
                        y};
                    cv::rectangle(sheet, centeredRect(center, inner), cv::Scalar(0),
                        innerThickness, cv::LINE_8);
                    drawFittedText(answerLabels[answer], center, inner,
                        std::max(1, innerThickness / 2));
                }
            }
        }
        return sheet;
    }

    uint32_t SheetGenerator::version() const noexcept
    {
        return m_version;
    }

    std::size_t SheetGenerator::questionCount() const noexcept
    {
        return m_questions.size();
    }

    std::vector<ArUcoDetection> SheetGrader::detectAruco(cv::Mat const& image)
    {
        m_source = image.clone();
        m_normalized.release();
        m_aruco.clear();
        m_detectedMarkers.clear();
        m_positioned.reset();
        if (image.empty()) {
            return {};
        }

        cv::Mat gray;
        if (image.channels() == 1) {
            gray = image;
        } else if (image.channels() == 4) {
            cv::cvtColor(image, gray, cv::COLOR_RGBA2GRAY);
        } else if (image.channels() == 3) {
            cv::cvtColor(image, gray, cv::COLOR_BGR2GRAY);
        } else {
            return {};
        }

        auto const& dictionary = SheetDictionary::value();
        cv::aruco::DetectorParameters detectorParameters;
        // The custom five-marker dictionary has inter-ID distance seven,
        // hence three safe marker-ID correction bits. OpenCV defaults to
        // using only 60% of that budget; use the complete guaranteed radius.
        detectorParameters.errorCorrectionRate = 1.0;
        cv::aruco::ArucoDetector detector(dictionary, detectorParameters);
        std::vector<int> ids;
        std::vector<std::vector<cv::Point2f>> corners;
        detector.detectMarkers(gray, corners, ids);

        struct Candidate
        {
            ArUcoDetection detection;
            DetectedMarker marker;
            double area{};
        };
        std::vector<Candidate> candidates;
        candidates.reserve(ids.size());
        for (std::size_t i = 0; i < ids.size(); ++i) {
            auto const canonical = SheetDictionary::canonicalId(ids[i]);
            if (!canonical) continue;
            auto const id = *canonical;
            if (corners[i].size() != 4) {
                continue;
            }
            auto const& value = corners[i];
            cv::Point2f center{};
            for (auto const& point : value) center += point;
            center *= 0.25F;
            auto angle = std::atan2(
                value[1].y - value[0].y,
                value[1].x - value[0].x) * 180.0 / std::acos(-1.0);
            if (angle < 0) angle += 360.0;

            candidates.push_back({
                {
                    id,
                    ConvertPoint(value[0]),
                    ConvertPoint(value[1]),
                    ConvertPoint(value[2]),
                    ConvertPoint(value[3]),
                },
                {id, center.x, center.y, angle},
                std::abs(cv::contourArea(value)),
            });
        }

        // An answer target can occasionally resemble one of the deliberately
        // small dictionary's codewords after it is filled and photographed.
        // Do not let one such local decode invalidate the entire sheet by
        // forwarding six candidates to the five-landmark positioner. Instead,
        // select the protocol-valid four/five-marker subset that spans the
        // sheet and whose equal-size printed markers have the most consistent
        // projected areas.
        constexpr std::size_t maximumCandidates = 12;
        if (candidates.size() > maximumCandidates) {
            std::ranges::partial_sort(
                candidates,
                candidates.begin() + maximumCandidates,
                std::greater{},
                &Candidate::area);
            candidates.resize(maximumCandidates);
        }

        std::optional<PositionedSheet> bestPositioned;
        std::vector<std::size_t> bestIndices;
        double bestScore = -std::numeric_limits<double>::infinity();
        auto evaluate = [&](std::vector<std::size_t> const& indices) {
            std::vector<DetectedMarker> markers;
            markers.reserve(indices.size());
            double minimumArea = std::numeric_limits<double>::infinity();
            double maximumArea = 0.0;
            double minimumX = std::numeric_limits<double>::infinity();
            double maximumX = -std::numeric_limits<double>::infinity();
            double minimumY = std::numeric_limits<double>::infinity();
            double maximumY = -std::numeric_limits<double>::infinity();
            for (auto const index : indices) {
                auto const& candidate = candidates[index];
                markers.push_back(candidate.marker);
                minimumArea = std::min(minimumArea, candidate.area);
                maximumArea = std::max(maximumArea, candidate.area);
                minimumX = std::min(minimumX, candidate.marker.centerX);
                maximumX = std::max(maximumX, candidate.marker.centerX);
                minimumY = std::min(minimumY, candidate.marker.centerY);
                maximumY = std::max(maximumY, candidate.marker.centerY);
            }
            auto positioned = MarkerPositioner::position(markers);
            if (!positioned || minimumArea <= 0.0 || maximumArea <= 0.0) return;
            auto const coverage = (maximumX - minimumX) * (maximumY - minimumY)
                / static_cast<double>(gray.cols * gray.rows);
            auto const areaConsistency = minimumArea / maximumArea;
            // Coverage strongly favors the page perimeter over the answer
            // grid; consistency rejects smaller nested answer targets. The
            // small count bonus chooses all five genuine landmarks when both
            // a four- and five-marker solution are otherwise equivalent.
            auto const score = coverage * areaConsistency
                * (1.0 + 0.02 * static_cast<double>(indices.size() - 4));
            if (score > bestScore) {
                bestScore = score;
                bestIndices = indices;
                bestPositioned = std::move(positioned);
            }
        };
        for (std::size_t count : {std::size_t{5}, std::size_t{4}}) {
            if (candidates.size() < count) continue;
            std::vector<std::size_t> indices;
            std::function<void(std::size_t)> visit = [&](std::size_t next) {
                if (indices.size() == count) {
                    evaluate(indices);
                    return;
                }
                auto const needed = count - indices.size();
                for (std::size_t index = next;
                     index + needed <= candidates.size(); ++index) {
                    indices.push_back(index);
                    visit(index + 1);
                    indices.pop_back();
                }
            };
            visit(0);
        }

        if (bestPositioned) {
            m_positioned = std::move(bestPositioned);
            for (auto const index : bestIndices) {
                m_aruco.push_back(candidates[index].detection);
                m_detectedMarkers.push_back(candidates[index].marker);
            }
        } else {
            // Preserve raw detections for diagnostics when no sheet-consistent
            // subset can be resolved.
            for (auto const& candidate : candidates) {
                m_aruco.push_back(candidate.detection);
                m_detectedMarkers.push_back(candidate.marker);
            }
        }
        return m_aruco;
    }

    bool SheetGrader::normalize(cv::Size sheetOriginalSize)
    {
        m_normalized.release();
        if (!m_positioned || m_source.empty()
            || sheetOriginalSize.width <= 0 || sheetOriginalSize.height <= 0) {
            return false;
        }
        auto const config = sheetVersionConfig(m_positioned->version);
        if (!config) {
            return false;
        }

        std::vector<cv::Point2f> source;
        std::vector<cv::Point2f> target;
        constexpr std::array cornerPositions{
            MarkerPosition::TL, MarkerPosition::TR,
            MarkerPosition::BR, MarkerPosition::BL};
        for (auto const position : cornerPositions) {
            auto const found = std::ranges::find_if(
                m_positioned->markers,
                [position](PositionedMarker const& value) {
                    return value.position == position;
                });
            if (found == m_positioned->markers.end()) continue;
            source.emplace_back(
                static_cast<float>(found->marker.centerX),
                static_cast<float>(found->marker.centerY));
            auto const canonical = markerCenter(*config, position);
            target.emplace_back(
                static_cast<float>(canonical.x) * sheetOriginalSize.width / config->referenceSize.width,
                static_cast<float>(canonical.y) * sheetOriginalSize.height / config->referenceSize.height);
        }
        if (source.size() < 3) {
            return false;
        }
        if (source.size() == 4) {
            auto const transform = cv::getPerspectiveTransform(source, target);
            cv::warpPerspective(
                m_source, m_normalized, transform, sheetOriginalSize,
                cv::INTER_NEAREST, cv::BORDER_CONSTANT, cv::Scalar(255));
        } else {
            // FB lies on the BL-BR baseline, so it cannot replace a missing
            // corner in a projective homography. Three genuine corners define
            // a stable affine fallback for a one-corner-missing scan.
            auto const transform = cv::getAffineTransform(source, target);
            cv::warpAffine(
                m_source, m_normalized, transform, sheetOriginalSize,
                cv::INTER_NEAREST, cv::BORDER_CONSTANT, cv::Scalar(255));
        }
        return !m_normalized.empty();
    }

    std::optional<RevisionDetection> SheetGrader::detectRevisionId()
    {
        if (!m_positioned || m_normalized.empty()) {
            return std::nullopt;
        }
        auto const config = sheetVersionConfig(m_positioned->version);
        if (!config) return std::nullopt;
        auto const topLeft = scalePoint(
            config->identityCodeArea.tl(), config->referenceSize, m_normalized.size());
        auto const size = scaleSize(
            config->identityCodeArea.size(), config->referenceSize, m_normalized.size());
        auto detections = OpenOmr::detectQrCode(
            m_normalized, cv::Rect(topLeft, size));
        auto convert = [](QrDetection const& detection)
            -> std::optional<RevisionDetection> {
            auto revisionId = parseRevisionPayload(detection.data);
            if (!revisionId) return std::nullopt;
            return RevisionDetection{
                *revisionId, detection.tl, detection.tr,
                detection.br, detection.bl};
        };
        for (auto const& detection : detections) {
            if (auto result = convert(detection)) return result;
        }

        // A perspective scan followed by normalization resamples QR modules a
        // second time. If that loses decodability, the once-sampled source is
        // often cleaner; detect globally because its ROI is not normalized.
        detections = OpenOmr::detectQrCode(m_source);
        for (auto const& detection : detections) {
            if (auto result = convert(detection)) return result;
        }
        return std::nullopt;
    }

    namespace
    {
        double darkRatio(cv::Mat const& gray, cv::Rect area)
        {
            area &= cv::Rect({}, gray.size());
            if (area.empty()) return 0.0;
            cv::Mat dark;
            cv::threshold(gray(area), dark, 128, 255, cv::THRESH_BINARY_INV);
            return static_cast<double>(cv::countNonZero(dark)) / area.area();
        }

        double correctionRatio(
            cv::Mat const& gray,
            cv::Rect outer,
            cv::Rect inner)
        {
            outer &= cv::Rect({}, gray.size());
            inner &= outer;
            if (outer.empty()) return 0.0;
            cv::Mat mask(outer.size(), CV_8UC1, cv::Scalar(255));
            auto relativeInner = inner - outer.tl();
            if (!relativeInner.empty()) {
                cv::rectangle(mask, relativeInner, cv::Scalar(0), cv::FILLED);
            }
            // Ignore the printed outer border; corrections are measured in
            // the writable ring between the two printed squares.
            cv::rectangle(mask, cv::Rect({}, outer.size()), cv::Scalar(0), 3);
            cv::Mat dark;
            cv::threshold(gray(outer), dark, 128, 255, cv::THRESH_BINARY_INV);
            cv::bitwise_and(dark, mask, dark);
            auto const samples = cv::countNonZero(mask);
            return samples == 0 ? 0.0
                : static_cast<double>(cv::countNonZero(dark)) / samples;
        }

        double frameRatio(cv::Mat const& gray, cv::Rect area)
        {
            area &= cv::Rect({}, gray.size());
            if (area.empty()) return 0.0;
            cv::Mat mask(area.size(), CV_8UC1, cv::Scalar(0));
            cv::rectangle(mask, cv::Rect({}, area.size()), cv::Scalar(255), 3);
            cv::Mat dark;
            cv::threshold(gray(area), dark, 128, 255, cv::THRESH_BINARY_INV);
            cv::bitwise_and(dark, mask, dark);
            auto const samples = cv::countNonZero(mask);
            return samples == 0 ? 0.0
                : static_cast<double>(cv::countNonZero(dark)) / samples;
        }
    }

    std::vector<uint8_t> SheetGrader::gradeSheet(
        cv::Size cellSize,
        cv::Size innerCellSize)
    {
        std::vector<uint8_t> result;
        if (!m_positioned || m_normalized.empty()
            || cellSize.width <= 0 || cellSize.height <= 0
            || innerCellSize.width <= 0 || innerCellSize.height <= 0) {
            return result;
        }
        auto const config = sheetVersionConfig(m_positioned->version);
        if (!config) return result;

        cv::Mat gray;
        if (m_normalized.channels() == 1) gray = m_normalized;
        else if (m_normalized.channels() == 4) cv::cvtColor(m_normalized, gray, cv::COLOR_RGBA2GRAY);
        else cv::cvtColor(m_normalized, gray, cv::COLOR_BGR2GRAY);

        auto const gridTopLeft = scalePoint(
            config->gridArea.tl(), config->referenceSize, gray.size());
        // API dimensions are authoritative when supplied; config dimensions
        // define generated defaults and row capacity.
        auto const step = cellSize;
        auto const innerSize = innerCellSize;

        auto const rowsPerBlock = config->gridArea.height / config->cellSize.height;
        auto const gridRight = scalePoint(
            config->gridArea.br(), config->referenceSize, gray.size()).x;
        auto const gutter = scaleSize(
            {config->questionColumnGutter, config->questionColumnGutter},
            config->referenceSize, gray.size()).width;
        auto blockX = gridTopLeft.x;
        while (blockX + 2 * step.width <= gridRight) {
            // The first row's top edge is contiguous exactly across this
            // block. Probe cell-width segments to recover its local width.
            std::uint32_t blockAnswers = 0;
            for (std::uint32_t cell = 0; cell <= config->maxAnswerCount; ++cell) {
                auto const edge = cv::Rect{
                    blockX + static_cast<int>(cell) * step.width + 3,
                    gridTopLeft.y - 2,
                    std::max(1, step.width - 6), 5};
                if (darkRatio(gray, edge) <= 0.25) break;
                if (cell > 0) blockAnswers = cell;
            }
            if (blockAnswers == 0) break;

            for (int row = 0; row < rowsPerBlock; ++row) {
                auto const y = gridTopLeft.y + row * step.height
                    + step.height / 2;
                auto const topEdge = cv::Rect{
                    blockX + 3, y - step.height / 2 - 2,
                    std::max(1, step.width - 6), 5};
                auto const bottomEdge = cv::Rect{
                    blockX + 3, y + step.height / 2 - 2,
                    std::max(1, step.width - 6), 5};
                if (darkRatio(gray, topEdge) <= 0.25
                    || darkRatio(gray, bottomEdge) <= 0.25) break;

                uint8_t flags = 0;
                for (std::uint32_t answer = 0; answer < blockAnswers; ++answer) {
                    auto const center = cv::Point{
                        blockX + static_cast<int>(answer + 1U) * step.width
                            + step.width / 2,
                        y};
                    auto const outer = centeredRect(center, step);
                    auto const inner = centeredRect(center, innerSize);
                    if (frameRatio(gray, inner) <= 0.12) continue;

                    auto answerArea = inner;
                    answerArea.x += 2;
                    answerArea.y += 2;
                    answerArea.width = std::max(1, answerArea.width - 4);
                    answerArea.height = std::max(1, answerArea.height - 4);
                    auto const answerMarked = darkRatio(gray, answerArea)
                        >= config->answerFillThreshold;
                    auto const correctionMarked = correctionRatio(gray, outer, inner)
                        >= config->correctionFillThreshold;
                    if (answerMarked && !correctionMarked) {
                        flags |= static_cast<uint8_t>(1U << answer);
                    }
                }
                result.push_back(flags);
            }
            blockX += static_cast<int>(blockAnswers + 1U) * step.width + gutter;
        }
        return result;
    }

    std::optional<uint32_t> SheetGrader::detectedVersion() const noexcept
    {
        if (!m_positioned) return std::nullopt;
        return m_positioned->version;
    }

    cv::Mat const& SheetGrader::normalizedImage() const noexcept
    {
        return m_normalized;
    }




};