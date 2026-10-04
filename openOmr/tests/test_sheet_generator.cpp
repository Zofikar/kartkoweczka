#include <openOmr/api.h>
#include <openOmr/marker_positioner.h>
#include <openOmr/sheet_dictionary.h>
#include <openOmr/sheet_config.h>
#include "test_revision_id.h"

#include <opencv2/objdetect/aruco_detector.hpp>

#include <cassert>
#include <cstdint>
#include <iostream>
#include <set>
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

    void testInheritedConfigurations()
    {
        auto const latest = OpenOmr::sheetVersionConfig(OpenOmr::MarkerPositioner::LatestVersion);
        assert(latest);
        for (std::uint32_t version = 1; version <= OpenOmr::MarkerPositioner::LatestVersion; ++version) {
            auto const config = OpenOmr::sheetVersionConfig(version);
            assert(config);
            assert(config->version == version);
            assert(config->referenceSize == latest->referenceSize);
            assert(config->markerSize == latest->markerSize);
            assert(config->identityCodeArea == latest->identityCodeArea);
            assert(config->cellSize == latest->cellSize);
            assert(config->innerSquareRatio == latest->innerSquareRatio);
            assert(config->innerSquareThickness == latest->innerSquareThickness);
        }
    }

    void testDerivedGeometry()
    {
        auto const config = OpenOmr::sheetVersionConfig(64);
        assert(config);
        auto const halfMarker = config->markerSize / 2;
        auto const innerGuideEdge = config->guideInset;

        assert(OpenOmr::markerCenter(*config, OpenOmr::MarkerPosition::TL).x
            - halfMarker - innerGuideEdge == config->quietZone);
        assert(OpenOmr::markerCenter(*config, OpenOmr::MarkerPosition::TL).y
            - halfMarker - innerGuideEdge == config->quietZone);
        assert(OpenOmr::markerCenter(*config, OpenOmr::MarkerPosition::FB).x
            - halfMarker
            - (OpenOmr::markerCenter(*config, OpenOmr::MarkerPosition::BL).x
                + halfMarker)
            == config->quietZone);
        assert(config->referenceSize.height - config->identityCodeArea.br().y
            == config->quietZone);
        assert(OpenOmr::markerCenter(*config, OpenOmr::MarkerPosition::BR).x
            - halfMarker - config->identityCodeArea.br().x == config->quietZone);
        assert(config->identityCodeArea.y - config->gridArea.br().y == 24);
        assert((config->identityCodeArea & config->gridArea).empty());
        for (auto const position : {
                 OpenOmr::MarkerPosition::TL, OpenOmr::MarkerPosition::TR,
                 OpenOmr::MarkerPosition::BR, OpenOmr::MarkerPosition::BL,
                 OpenOmr::MarkerPosition::FB}) {
            auto const center = OpenOmr::markerCenter(*config, position);
            auto const markerArea = cv::Rect{
                center.x - halfMarker, center.y - halfMarker,
                config->markerSize, config->markerSize};
            assert((markerArea & config->gridArea).empty());
        }
        assert(OpenOmr::innerSquareSize(*config).width
            == static_cast<int>(config->cellSize.width * config->innerSquareRatio));
        assert(config->cellSize == cv::Size(84, 84));
        assert(OpenOmr::innerSquareSize(*config) == cv::Size(42, 42));
        assert(config->gridArea.width == 1660);
        assert(OpenOmr::maxQuestionCount(*config, 4) == 54);
        assert(OpenOmr::maxQuestionCount(*config, 8) == 36);
        assert(OpenOmr::maxQuestionCount(*config, 9) == 0);
    }

    void testGeneratorValidation()
    {
        OpenOmr::SheetGenerator generator;
        assert(!generator.setFont({1, 2, 3, 4}));
        // Empty input deliberately restores the deterministic built-in
        // fallback and is therefore valid.
        assert(generator.setFont({}));
        assert(!generator.addQuestion(1, 0, labels(4)));
        assert(!generator.initializeForVersion({1000, 1000}, testRevisionId(2), 0));
        assert(!generator.initializeForVersion({1000, 1000}, testRevisionId(2), 65));
        assert(!generator.initializeForVersion({1000, 1000}, {}, 64));
        assert(generator.initializeForVersion({1000, 1000}, testRevisionId(2), 64));
        assert(!generator.addQuestion(1, 0, {}));
        assert(!generator.addQuestion(1, 0, labels(9)));
        assert(!generator.addQuestion(1, 0, {""}));
        assert(!generator.addQuestion(1, 0, {"TOO-LONG"}));
        assert(!generator.addQuestion(1, 0, {"lower"}));
        assert(!generator.addQuestion(1, 0, {"A_"}));
        assert(generator.addQuestion(1, 0, labels(8)));
        assert(!generator.addQuestion(1, 0, labels(8)));
        assert(generator.questionCount() == 1);
    }

    void testMultiColumnCapacity()
    {
        auto const config = OpenOmr::sheetVersionConfig(64);
        assert(config);
        OpenOmr::SheetGenerator generator;
        assert(generator.initializeForVersion(
            config->referenceSize, testRevisionId(3), 64));
        for (std::uint32_t question = 1; question <= 54; ++question) {
            assert(generator.addQuestion(question, 0, labels(4)));
        }
        assert(generator.questionCount() == 54);
        assert(!generator.addQuestion(55, 0, labels(4)));
        assert(!generator.generate().empty());
    }

    void testEveryVersionRendersItsMarkers()
    {
        auto const latest = OpenOmr::sheetVersionConfig(
            OpenOmr::MarkerPositioner::LatestVersion);
        assert(latest);
        auto const& dictionary = OpenOmr::SheetDictionary::value();
        cv::aruco::DetectorParameters detectorParameters;
        detectorParameters.errorCorrectionRate = 1.0;
        cv::aruco::ArucoDetector detector(dictionary, detectorParameters);

        for (std::uint32_t version = 1; version <= OpenOmr::MarkerPositioner::LatestVersion; ++version) {
            OpenOmr::SheetGenerator generator;
            assert(generator.initializeForVersion(
                latest->referenceSize, testRevisionId(version), version));
            assert(generator.addQuestion(1, 0, {"T", "F"}));
            assert(generator.addQuestion(2, 0, labels(8)));
            auto const sheet = generator.generate();
            assert(!sheet.empty());
            assert(sheet.size() == latest->referenceSize);
            assert(sheet.type() == CV_8UC1);

            std::vector<int> ids;
            std::vector<std::vector<cv::Point2f>> corners;
            detector.detectMarkers(sheet, corners, ids);
            assert(ids.size() == 5);

            auto const placements = OpenOmr::MarkerPositioner::placements(version);
            assert(placements);
            std::multiset<int> expected;
            std::multiset<int> actual(ids.begin(), ids.end());
            for (auto const& placement : *placements) {
                auto const local = OpenOmr::SheetDictionary::localId(placement.id);
                assert(local);
                expected.insert(*local);
            }
            assert(actual == expected);
        }
    }
}

int main()
{
    testInheritedConfigurations();
    testDerivedGeometry();
    testGeneratorValidation();
    testMultiColumnCapacity();
    testEveryVersionRendersItsMarkers();
    std::cout << "Sheet generator tests passed\n";
}
