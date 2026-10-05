#include <openOmr/api.h>
#include <openOmr/marker_positioner.h>
#include <openOmr/sheet_config.h>
#include "test_revision_id.h"

#include <opencv2/imgproc.hpp>

#include <array>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <random>
#include <string>
#include <vector>

namespace
{
    constexpr std::uint32_t Seed = 0x5EED2026U;

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

    void markInner(
        cv::Mat& sheet,
        OpenOmr::SheetVersionConfig const& config,
        std::uint32_t row,
        std::uint32_t answer)
    {
        auto const center = cv::Point{
            config.gridArea.x + static_cast<int>(answer + 1U) * config.cellSize.width
                + config.cellSize.width / 2,
            config.gridArea.y + static_cast<int>(row) * config.cellSize.height
                + config.cellSize.height / 2};
        auto area = centeredRect(center, OpenOmr::innerSquareSize(config));
        area.x += 2;
        area.y += 2;
        area.width -= 4;
        area.height -= 4;
        cv::rectangle(sheet, area, cv::Scalar(0), cv::FILLED);
    }

    void markOuterCorrection(
        cv::Mat& sheet,
        OpenOmr::SheetVersionConfig const& config,
        std::uint32_t row,
        std::uint32_t answer)
    {
        auto const center = cv::Point{
            config.gridArea.x + static_cast<int>(answer + 1U) * config.cellSize.width
                + config.cellSize.width / 2,
            config.gridArea.y + static_cast<int>(row) * config.cellSize.height
                + config.cellSize.height / 2};
        auto outer = centeredRect(center, config.cellSize);
        auto inner = centeredRect(center, OpenOmr::innerSquareSize(config));
        outer.x += 4;
        outer.y += 4;
        outer.width -= 8;
        outer.height -= 8;
        cv::rectangle(sheet, outer, cv::Scalar(0), cv::FILLED);
        cv::rectangle(sheet, inner, cv::Scalar(255), cv::FILLED);
        cv::rectangle(sheet, inner, cv::Scalar(0), config.innerSquareThickness);
    }

    cv::Mat transformed(
        cv::Mat const& sheet,
        std::mt19937& random,
        std::uint32_t quarterTurns,
        bool perspective)
    {
        std::uniform_int_distribution<int> jitter(-18, 18);
        auto const w = static_cast<float>(sheet.cols - 1);
        auto const h = static_cast<float>(sheet.rows - 1);
        std::array<cv::Point2f, 4> source{{
            {0, 0}, {w, 0}, {w, h}, {0, h}}};
        std::array<cv::Point2f, 4> target{};
        if (perspective) {
            target = {{
                {30.0F + jitter(random), 30.0F + jitter(random)},
                {w - 30.0F + jitter(random), 30.0F + jitter(random)},
                {w - 30.0F + jitter(random), h - 30.0F + jitter(random)},
                {30.0F + jitter(random), h - 30.0F + jitter(random)}}};
        } else {
            // With one true corner absent, only an affine transform is
            // recoverable from the remaining three corners. Keep this case
            // affine while still randomizing scale, shear, and translation.
            cv::Point2f const origin{
                30.0F + jitter(random), 30.0F + jitter(random)};
            cv::Point2f const xAxis{
                w - 60.0F + jitter(random), static_cast<float>(jitter(random))};
            cv::Point2f const yAxis{
                static_cast<float>(jitter(random)), h - 60.0F + jitter(random)};
            target = {{origin, origin + xAxis, origin + xAxis + yAxis,
                origin + yAxis}};
        }
        cv::Mat warped;
        cv::warpPerspective(
            sheet, warped, cv::getPerspectiveTransform(source, target),
            sheet.size(), cv::INTER_NEAREST, cv::BORDER_CONSTANT,
            cv::Scalar(255));

        cv::Mat rotated;
        switch (quarterTurns % 4) {
        case 1: cv::rotate(warped, rotated, cv::ROTATE_90_CLOCKWISE); break;
        case 2: cv::rotate(warped, rotated, cv::ROTATE_180); break;
        case 3: cv::rotate(warped, rotated, cv::ROTATE_90_COUNTERCLOCKWISE); break;
        default: rotated = warped; break;
        }
        return rotated;
    }

    void runVersion(std::uint32_t version, std::mt19937& random)
    {
        auto const config = OpenOmr::sheetVersionConfig(version);
        assert(config);
        auto const revisionId = testRevisionId(version);
        auto const rowCount = 1U + (random() % 8U);

        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(config->referenceSize, revisionId, version));
        for (std::uint32_t row = 0; row < rowCount; ++row) {
            assert(generator.addQuestion(row + 1, random() % 3U, labels(8)));
        }
        auto sheet = generator.generate();
        assert(!sheet.empty());

        std::vector<std::uint8_t> expected(rowCount, 0);
        for (std::uint32_t row = 0; row < rowCount; ++row) {
            for (std::uint32_t answer = 0; answer < 8; ++answer) {
                auto const selected = (random() % 100U) < 35U;
                auto const corrected = (random() % 100U) < 20U;
                if (selected) markInner(sheet, *config, row, answer);
                if (corrected) markOuterCorrection(sheet, *config, row, answer);
                if (selected && !corrected) {
                    expected[row] |= static_cast<std::uint8_t>(1U << answer);
                }
            }
        }

        // Exercise checksum recovery and FB fallback by hiding one of the five
        // landmarks in a deterministic rotating pattern.
        auto const missingIndex = version % config->markerCenters.size();
        auto const missingCenter = config->markerCenters[missingIndex];
        cv::rectangle(
            sheet,
            centeredRect(missingCenter, {config->markerSize + 16, config->markerSize + 16}),
            cv::Scalar(255), cv::FILLED);

        auto scan = transformed(
            sheet, random, version % 4U,
            true);
        OpenOmr::SheetGrader grader;
        auto const detections = grader.detectAruco(scan);
        if (detections.size() != 4 || grader.detectedVersion() != version) {
            std::cerr << "marker failure seed=" << Seed << " version=" << version
                      << " detections=" << detections.size() << '\n';
        }
        assert(detections.size() == 4);
        assert(grader.detectedVersion() == version);
        assert(grader.normalize(config->referenceSize));

        auto const identity = grader.detectRevisionId();
        if (!identity || !std::ranges::equal(identity->revisionId, revisionId)) {
            std::cerr << "revision ID failure seed=" << Seed << " version=" << version << '\n';
        }
        assert(identity && std::ranges::equal(identity->revisionId, revisionId));

        auto const actual = grader.gradeSheet(
            config->cellSize, OpenOmr::innerSquareSize(*config));
        if (actual != expected) {
            std::cerr << "grading failure seed=" << Seed << " version=" << version
                      << " missingIndex=" << missingIndex
                      << " expectedRows=" << expected.size()
                      << " actualRows=" << actual.size() << '\n';
            for (std::size_t row = 0; row < expected.size(); ++row) {
                std::cerr << " row=" << row
                          << " expected=" << static_cast<unsigned>(expected[row])
                          << " actual=";
                if (row < actual.size()) {
                    std::cerr << static_cast<unsigned>(actual[row]);
                } else {
                    std::cerr << "<missing>";
                }
                std::cerr << '\n';
            }
        }
        assert(actual == expected);
    }
}

int main()
{
    std::mt19937 random(Seed);
    for (std::uint32_t version = 1;
         version <= OpenOmr::MarkerPositioner::LatestVersion;
         ++version) {
        runVersion(version, random);
    }
    std::cout << "Randomized workflow tests passed (seed=" << Seed << ")\n";
}
