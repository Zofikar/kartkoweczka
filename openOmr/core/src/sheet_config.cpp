#include <openOmr/sheet_config.h>

namespace OpenOmr
{
    std::optional<SheetVersionConfig> sheetVersionConfig(std::uint32_t version)
    {
        if (version == 0 || version > MarkerPositioner::LatestVersion) {
            return std::nullopt;
        }

        // Versions without a dedicated geometry intentionally inherit the
        // latest layout while retaining their own marker-encoded version.
        return SheetVersionConfig{
            .version = version,
            // Canonical web/print geometry: 180 x 205 mm at 10 units/mm.
            .referenceSize = {1800, 2050},
            .guideInset = 50,
            .guideLength = 120,
            .guideThickness = 4,
            .quietZone = 30,
            .markerSize = 120,
            .markerCenters = {{
                {140, 140},   // TL: guide + quiet zone + half marker
                {1660, 140},  // TR
                {1660, 1910}, // BR
                {140, 1910},  // BL
                {290, 1910},  // FB: one quiet zone after BL
            }},
            // Compact binary revision QR, bottom-aligned with the old code.
            // Version-2 QR plus quiet zone is 33 modules; 264 canonical units
            // gives an exact 8 pixels/module before print scaling.
            .identityCodeArea = {1306, 1756, 264, 264},
            // The grid reserves one leading question-number column.
            // Matura-scale 8.4 mm cells fit 18 questions. The
            // 166 mm reservation fits the requested 40-question mixed sheet
            // as ordered 18 + 18 + 4 question blocks.
            .cellSize = {84, 84},
            .gridArea = {70, 220, 1660, 1512},
            .questionColumnGutter = 80,
            .maxAnswerCount = 8,
            .innerSquareRatio = 0.5,
            // 0.4 mm / 1.13 pt. After flat A5 scaling this remains about
            // 0.283 mm, or 2.23 printer dots at 200 DPI.
            .innerSquareThickness = 4,
            // Filled human marks remain well above 50% after normalization;
            // the lower answer threshold tolerates erosion while the higher
            // correction threshold rejects inner-frame bleed into the ring.
            .answerFillThreshold = 0.50,
            .correctionFillThreshold = 0.50,
        };
    }

    cv::Point markerCenter(
        SheetVersionConfig const& config,
        MarkerPosition position)
    {
        return config.markerCenters[static_cast<std::size_t>(position)];
    }

    cv::Size innerSquareSize(SheetVersionConfig const& config)
    {
        return {
            static_cast<int>(config.cellSize.width * config.innerSquareRatio),
            static_cast<int>(config.cellSize.height * config.innerSquareRatio),
        };
    }

    std::uint32_t maxQuestionCount(
        SheetVersionConfig const& config,
        std::uint32_t maxAnswerCount)
    {
        if (maxAnswerCount == 0 || maxAnswerCount > config.maxAnswerCount
            || static_cast<int>(maxAnswerCount + 1) * config.cellSize.width
                > config.gridArea.width
            || config.cellSize.height <= 0) {
            return 0;
        }
        auto const totalRows = config.gridArea.height / config.cellSize.height;
        if (totalRows <= 0) return 0;
        auto const blockWidth = static_cast<int>(maxAnswerCount + 1)
            * config.cellSize.width;
        auto const blockCount = (config.gridArea.width + config.questionColumnGutter)
            / (blockWidth + config.questionColumnGutter);
        return static_cast<std::uint32_t>(totalRows * blockCount);
    }
}
