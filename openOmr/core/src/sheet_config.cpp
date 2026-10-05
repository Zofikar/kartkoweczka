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
            .guideInset = 20,
            .guideLength = 120,
            .guideThickness = 4,
            .quietZone = 30,
            .markerSize = 120,
            .markerCenters = {{
                {126, 126},   // TL: QR-sized padding clears the guide stroke
                {1674, 126},  // TR
                {1674, 1918}, // BR: visible bottom edge matches QR ink
                {126, 1918},  // BL: visible bottom edge matches QR ink
                {331, 1859},  // FB: adjacent padded bounds, no extra quiet-zone gap
            }},
            // Compact binary revision QR, bottom-aligned with the old code.
            // Includes encoder padding and the explicit four-module quiet
            // zone. Visible QR ink spans y=[1799,1978), not the full ROI.
            .identityCodeArea = {1306, 1756, 264, 264},
            // The grid reserves one leading question-number column.
            // Matura-scale 8.4 mm cells fit 18 questions. The
            // 166 mm reservation fits the requested 40-question mixed sheet
            // as ordered 18 + 18 + 4 question blocks.
            .cellSize = {84, 84},
            // Clear the top markers' padded bounds (ending at y=228),
            // including the grid border stroke; retain all 18 rows.
            .gridArea = {70, 232, 1660, 1512},
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
