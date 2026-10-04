#include <openOmr/api.h>
#include <openOmr/marker_positioner.h>
#include <openOmr/sheet_dictionary.h>
#include <openOmr/sheet_config.h>
#include "test_revision_id.h"

#include <opencv2/imgproc.hpp>
#include <opencv2/objdetect/aruco_detector.hpp>

#include <array>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <string>
#include <vector>

namespace
{
    std::vector<std::string> labels(std::uint32_t count)
    {
        std::vector<std::string> result;
        for (std::uint32_t index = 0; index < count; ++index) {
            result.emplace_back(1, static_cast<char>('A' + index));
        }
        return result;
    }

    cv::Rect centeredRect(cv::Point center, cv::Size size)
    {
        return {center.x - size.width / 2, center.y - size.height / 2,
            size.width, size.height};
    }

    void markSmall(
        cv::Mat& sheet,
        OpenOmr::SheetVersionConfig const& config,
        std::uint32_t row,
        std::uint32_t answer,
        int blockX = -1)
    {
        if (blockX < 0) blockX = config.gridArea.x;
        auto const center = cv::Point{
            blockX + static_cast<int>(answer + 1U) * config.cellSize.width
                + config.cellSize.width / 2,
            config.gridArea.y + static_cast<int>(row) * config.cellSize.height
                + config.cellSize.height / 2,
        };
        auto area = centeredRect(center, OpenOmr::innerSquareSize(config));
        area.x += 2;
        area.y += 2;
        area.width -= 4;
        area.height -= 4;
        cv::rectangle(sheet, area, cv::Scalar(0), cv::FILLED);
    }

    void markCorrection(
        cv::Mat& sheet,
        OpenOmr::SheetVersionConfig const& config,
        std::uint32_t row,
        std::uint32_t answer)
    {
        auto const center = cv::Point{
            config.gridArea.x + static_cast<int>(answer + 1U) * config.cellSize.width
                + config.cellSize.width / 2,
            config.gridArea.y + static_cast<int>(row) * config.cellSize.height
                + config.cellSize.height / 2,
        };
        auto outer = centeredRect(center, config.cellSize);
        auto inner = centeredRect(center, OpenOmr::innerSquareSize(config));
        outer.x += 4;
        outer.y += 4;
        outer.width -= 8;
        outer.height -= 8;
        cv::rectangle(sheet, outer, cv::Scalar(0), cv::FILLED);
        // Keep the small square independently measurable. A correction is the
        // outer writable ring, not an accidental inner answer.
        cv::rectangle(sheet, inner, cv::Scalar(255), cv::FILLED);
        cv::rectangle(sheet, inner, cv::Scalar(0), config.innerSquareThickness);
    }

    void runVersion(std::uint32_t version)
    {
        auto const config = OpenOmr::sheetVersionConfig(version);
        assert(config);
        auto const revisionId = testRevisionId(version);

        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(config->referenceSize, revisionId, version));
        assert(generator.addQuestion(1, 0, labels(8)));
        assert(generator.addQuestion(2, 0, labels(8)));
        assert(generator.addQuestion(3, 0, labels(8)));
        auto sheet = generator.generate();
        assert(!sheet.empty());

        // Row 0: A, C and H are valid answers.
        markSmall(sheet, *config, 0, 0);
        markSmall(sheet, *config, 0, 2);
        markSmall(sheet, *config, 0, 7);

        // Row 1: B is valid. D was selected and then corrected.
        markSmall(sheet, *config, 1, 1);
        markSmall(sheet, *config, 1, 3);
        markCorrection(sheet, *config, 1, 3);

        // Row 2: correction-only E must not become an answer.
        markCorrection(sheet, *config, 2, 4);

        OpenOmr::SheetGrader grader;
        auto const aruco = grader.detectAruco(sheet);
        assert(aruco.size() == 5);
        assert(grader.detectedVersion() == version);
        assert(grader.normalize(config->referenceSize));
        assert(!grader.normalizedImage().empty());

        auto const identity = grader.detectRevisionId();
        assert(identity);
        assert(std::ranges::equal(identity->revisionId, revisionId));

        auto const answers = grader.gradeSheet(
            config->cellSize, OpenOmr::innerSquareSize(*config));
        assert(answers.size() == 3);
        assert(answers[0] == static_cast<std::uint8_t>((1U << 0) | (1U << 2) | (1U << 7)));
        assert(answers[1] == static_cast<std::uint8_t>(1U << 1));
        assert(answers[2] == 0);
    }

    void testTwentyFiveQuestionWorkflow()
    {
        auto const config = OpenOmr::sheetVersionConfig(64);
        assert(config);
        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(
            config->referenceSize, testRevisionId(4), 64));
        for (std::uint32_t question = 1; question <= 25; ++question) {
            assert(generator.addQuestion(question, 0, labels(4)));
        }
        auto sheet = generator.generate();
        assert(!sheet.empty());

        auto const secondBlockX = config->gridArea.x
            + 5 * config->cellSize.width + config->questionColumnGutter;
        std::vector<std::uint8_t> expected(25);
        for (std::uint32_t index = 0; index < 25; ++index) {
            auto const answer = index % 4U;
            markSmall(sheet, *config,
                index < 18 ? index : index - 18U,
                answer,
                index < 18 ? config->gridArea.x : secondBlockX);
            expected[index] = static_cast<std::uint8_t>(1U << answer);
        }

        OpenOmr::SheetGrader grader;
        assert(grader.detectAruco(sheet).size() == 5);
        assert(grader.detectedVersion() == 64);
        assert(grader.normalize(config->referenceSize));
        auto const identity = grader.detectRevisionId();
        assert(identity && std::ranges::equal(identity->revisionId, testRevisionId(4)));
        assert(grader.gradeSheet(
            config->cellSize, OpenOmr::innerSquareSize(*config)) == expected);
    }

    void testFortyQuestionOptimizedColumns()
    {
        auto const config = OpenOmr::sheetVersionConfig(64);
        assert(config);
        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(
            config->referenceSize, testRevisionId(5), 64));
        for (std::uint32_t question = 1; question <= 40; ++question) {
            auto answerLabels = question == 6 ? labels(6)
                : question == 18 ? std::vector<std::string>{"T", "F"}
                : labels(4);
            assert(generator.addQuestion(question, 0, std::move(answerLabels)));
        }
        auto sheet = generator.generate();
        assert(!sheet.empty());

        auto const firstBlockX = config->gridArea.x;
        auto const secondBlockX = firstBlockX
            + 7 * config->cellSize.width + config->questionColumnGutter;
        auto const thirdBlockX = secondBlockX
            + 5 * config->cellSize.width + config->questionColumnGutter;
        std::vector<std::uint8_t> expected(40);
        for (std::uint32_t index = 0; index < 40; ++index) {
            auto const answer = index < 18 ? index % 6U : index % 4U;
            auto const row = index < 18 ? index
                : index < 36 ? index - 18U : index - 36U;
            auto const blockX = index < 18 ? firstBlockX
                : index < 36 ? secondBlockX : thirdBlockX;
            markSmall(sheet, *config, row, answer, blockX);
            expected[index] = static_cast<std::uint8_t>(1U << answer);
        }

        OpenOmr::SheetGrader grader;
        assert(grader.detectAruco(sheet).size() == 5);
        assert(grader.detectedVersion() == 64);
        assert(grader.normalize(config->referenceSize));
        auto const identity = grader.detectRevisionId();
        assert(identity && std::ranges::equal(identity->revisionId, testRevisionId(5)));
        assert(grader.gradeSheet(
            config->cellSize, OpenOmr::innerSquareSize(*config)) == expected);
    }

    void testFlatA5At200Dpi()
    {
        auto const config = OpenOmr::sheetVersionConfig(64);
        assert(config);
        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(
            config->referenceSize, testRevisionId(6), 64));
        for (std::uint32_t question = 1; question <= 40; ++question) {
            auto answerLabels = question == 6 ? labels(6)
                : question == 18 ? std::vector<std::string>{"T", "F"}
                : labels(4);
            assert(generator.addQuestion(question, 0, std::move(answerLabels)));
        }
        auto canonical = generator.generate();
        assert(!canonical.empty());

        auto const secondBlockX = config->gridArea.x
            + 7 * config->cellSize.width + config->questionColumnGutter;
        auto const thirdBlockX = secondBlockX
            + 5 * config->cellSize.width + config->questionColumnGutter;
        std::vector<std::uint8_t> expected(40);
        for (std::uint32_t index = 0; index < 40; ++index) {
            auto const answer = index < 18 ? index % 6U : index % 4U;
            markSmall(canonical, *config,
                index < 18 ? index
                    : index < 36 ? index - 18U : index - 36U,
                answer,
                index < 18 ? config->gridArea.x
                    : index < 36 ? secondBlockX : thirdBlockX);
            expected[index] = static_cast<std::uint8_t>(1U << answer);
        }

        // Flat A4->A5 ISO scale (1/sqrt(2)), sampled at 200 DPI.
        constexpr double a5Scale = 0.7071067811865476;
        constexpr double dotsPerMm = 200.0 / 25.4;
        auto const rasterSize = cv::Size{
            static_cast<int>(std::lround(180.0 * a5Scale * dotsPerMm)),
            static_cast<int>(std::lround(205.0 * a5Scale * dotsPerMm)),
        };
        assert(rasterSize == cv::Size(1002, 1141));
        cv::Mat a5Raster;
        cv::resize(canonical, a5Raster, rasterSize, 0, 0, cv::INTER_AREA);

        OpenOmr::SheetGrader grader;
        assert(grader.detectAruco(a5Raster).size() == 5);
        assert(grader.detectedVersion() == 64);
        assert(grader.normalize(config->referenceSize));
        auto const identity = grader.detectRevisionId();
        assert(identity && std::ranges::equal(identity->revisionId, testRevisionId(6)));
        assert(grader.gradeSheet(
            config->cellSize, OpenOmr::innerSquareSize(*config)) == expected);
    }

    void testAnswerGridFalsePositiveIsRejected()
    {
        auto const config = OpenOmr::sheetVersionConfig(64);
        assert(config);
        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(
            config->referenceSize, testRevisionId(7), 64));
        assert(generator.addQuestion(1, 0, labels(4)));
        auto sheet = generator.generate();
        assert(!sheet.empty());

        // Deterministically emulate the reported failure class: a filled
        // answer target is decoded as a valid dictionary marker. A small real
        // codeword in the answer grid guarantees that OpenCV emits the extra
        // candidate, while protocol-aware selection must retain only the five
        // equal-sized sheet landmarks.
        auto const localId = OpenOmr::SheetDictionary::localId(
            OpenOmr::MarkerPositioner::CornerIds[0]);
        assert(localId);
        auto const falseSize = OpenOmr::innerSquareSize(*config).width;
        cv::Mat falseMarker;
        cv::aruco::generateImageMarker(
            OpenOmr::SheetDictionary::value(), *localId,
            falseSize, falseMarker, 1);
        auto const center = cv::Point{
            config->gridArea.x + config->cellSize.width + config->cellSize.width / 2,
            config->gridArea.y + config->cellSize.height / 2,
        };
        falseMarker.copyTo(sheet(centeredRect(center, falseMarker.size())));

        cv::aruco::DetectorParameters parameters;
        parameters.errorCorrectionRate = 1.0;
        cv::aruco::ArucoDetector rawDetector(
            OpenOmr::SheetDictionary::value(), parameters);
        std::vector<int> rawIds;
        std::vector<std::vector<cv::Point2f>> rawCorners;
        rawDetector.detectMarkers(sheet, rawCorners, rawIds);
        assert(rawIds.size() > 5);

        OpenOmr::SheetGrader grader;
        auto const detections = grader.detectAruco(sheet);
        assert(detections.size() == 5);
        assert(grader.detectedVersion() == 64);
        assert(grader.normalize(config->referenceSize));
        auto const identity = grader.detectRevisionId();
        assert(identity && std::ranges::equal(identity->revisionId, testRevisionId(7)));
    }
}

int main()
{
    for (std::uint32_t version = 1;
         version <= OpenOmr::MarkerPositioner::LatestVersion;
         ++version) {
        runVersion(version);
    }
    testTwentyFiveQuestionWorkflow();
    testFortyQuestionOptimizedColumns();
    testFlatA5At200Dpi();
    testAnswerGridFalsePositiveIsRejected();
    std::cout << "Full workflow tests passed\n";
}
