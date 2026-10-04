#include <openOmr/api.h>

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace
{
    std::vector<std::uint8_t> readBytes(std::filesystem::path const& path)
    {
        std::ifstream input(path, std::ios::binary | std::ios::ate);
        if (!input) return {};
        auto const size = input.tellg();
        if (size <= 0) return {};
        std::vector<std::uint8_t> bytes(static_cast<std::size_t>(size));
        input.seekg(0);
        input.read(reinterpret_cast<char*>(bytes.data()), size);
        return input ? bytes : std::vector<std::uint8_t>{};
    }

    void writeU16(std::ostream& output, std::uint16_t value)
    {
        output.put(static_cast<char>(value & 0xffU));
        output.put(static_cast<char>((value >> 8U) & 0xffU));
    }

    void writeU32(std::ostream& output, std::uint32_t value)
    {
        for (unsigned shift = 0; shift < 32; shift += 8) {
            output.put(static_cast<char>((value >> shift) & 0xffU));
        }
    }

    bool writeBmp(std::filesystem::path const& outputPath, cv::Mat const& gray)
    {
        if (gray.empty() || gray.type() != CV_8UC1) return false;

        auto const rowSize = static_cast<std::uint32_t>((gray.cols * 3 + 3) & ~3);
        auto const pixelBytes = rowSize * static_cast<std::uint32_t>(gray.rows);
        constexpr std::uint32_t pixelOffset = 14 + 40;

        std::ofstream output(outputPath, std::ios::binary);
        if (!output) return false;

        // BITMAPFILEHEADER
        output.put('B');
        output.put('M');
        writeU32(output, pixelOffset + pixelBytes);
        writeU16(output, 0);
        writeU16(output, 0);
        writeU32(output, pixelOffset);

        // BITMAPINFOHEADER
        writeU32(output, 40);
        writeU32(output, static_cast<std::uint32_t>(gray.cols));
        writeU32(output, static_cast<std::uint32_t>(gray.rows));
        writeU16(output, 1);
        writeU16(output, 24);
        writeU32(output, 0);
        writeU32(output, pixelBytes);
        // One pixel represents one canonical 0.1 mm unit. 10,000 px/m makes
        // the BMP's physical metadata exactly match the 180 x 205 mm block.
        writeU32(output, 10000);
        writeU32(output, 10000);
        writeU32(output, 0);
        writeU32(output, 0);

        std::vector<char> row(rowSize, 0);
        for (int y = gray.rows - 1; y >= 0; --y) {
            auto const* source = gray.ptr<std::uint8_t>(y);
            for (int x = 0; x < gray.cols; ++x) {
                row[x * 3] = static_cast<char>(source[x]);
                row[x * 3 + 1] = static_cast<char>(source[x]);
                row[x * 3 + 2] = static_cast<char>(source[x]);
            }
            output.write(row.data(), static_cast<std::streamsize>(row.size()));
        }
        return output.good();
    }
}

int main(int argc, char** argv)
{
    auto const output = std::filesystem::path{
        argc > 1 ? argv[1] : "sheet-preview.bmp"};

    OpenOmr::SheetGenerator generator;
    generator.initialize({1800, 2050}, {
        0x01, 0x8f, 0x12, 0x34, 0x56, 0x78, 0x7a, 0xbc,
        0x8d, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab});
    if (argc > 2) {
        auto font = readBytes(argv[2]);
        if (font.empty() || !generator.setFont(std::move(font))) {
            std::cerr << "Could not load preview font " << argv[2] << '\n';
            return 1;
        }
    }

    // Demonstrate caller-defined labels and optimized ordered columns.
    for (std::uint32_t question = 1; question <= 40; ++question) {
        auto labels = question == 6
            ? std::vector<std::string>{"A", "B", "C", "D", "E", "F"}
            : question == 18
                ? std::vector<std::string>{"T", "F"}
                : std::vector<std::string>{"A", "B", "C", "D"};
        if (!generator.addQuestion(question, 0, std::move(labels))) {
            std::cerr << "Could not configure preview question "
                      << question << '\n';
            return 1;
        }
    }

    auto const sheet = generator.generate();
    if (sheet.empty()) {
        std::cerr << "Could not generate preview sheet\n";
        return 1;
    }
    if (!writeBmp(output, sheet)) {
        std::cerr << "Could not write preview to " << output << '\n';
        return 1;
    }

    std::cout << "Generated " << std::filesystem::absolute(output)
              << " (version " << generator.version() << ", "
              << sheet.cols << 'x' << sheet.rows << ")\n";
    return 0;
}
