find_package(Python3 REQUIRED COMPONENTS Interpreter)

set(OPENOMR_FONT_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
set(OPENOMR_FONT_SOURCE_FILE "${OPENOMR_FONT_DIR}/Roboto-full.ttf")
set(OPENOMR_FONT_FILE "${OPENOMR_FONT_DIR}/Roboto-subset.ttf")
set(OPENOMR_FONT_HEADER "${OPENOMR_FONT_DIR}/default_font.h")
set(OPENOMR_FONT_SOURCE "${OPENOMR_FONT_DIR}/default_font.cpp")
file(MAKE_DIRECTORY "${OPENOMR_FONT_DIR}")

# Roboto from google/fonts, pinned by commit and checksum so builds remain
# reproducible. CMake reuses the downloaded file on subsequent configurations.
file(DOWNLOAD
        "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf"
        "${OPENOMR_FONT_SOURCE_FILE}"
        EXPECTED_HASH SHA256=d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134
        TLS_VERIFY ON
)
# Public labels are restricted to A-Z and question identifiers to decimal
# digits plus '.'. Subset the embedded fallback at build time rather than
# shipping Roboto's complete multilingual variable-font repertoire in Wasm.
# Runtime setFont() still accepts complete caller-provided fonts.
execute_process(
        COMMAND "${Python3_EXECUTABLE}" -m fontTools.subset
                "${OPENOMR_FONT_SOURCE_FILE}"
                "--output-file=${OPENOMR_FONT_FILE}"
                "--unicodes=U+002E,U+0030-0039,U+0041-005A"
                "--layout-features=*"
                "--no-hinting"
        COMMAND_ERROR_IS_FATAL ANY
)
execute_process(
        COMMAND "${Python3_EXECUTABLE}"
                "${CMAKE_SOURCE_DIR}/tools/embed_binary.py"
                "${OPENOMR_FONT_FILE}"
                "${OPENOMR_FONT_HEADER}"
                "${OPENOMR_FONT_SOURCE}"
        COMMAND_ERROR_IS_FATAL ANY
)

add_library(openOmr_core STATIC
        src/api.cpp
        src/marker_positioner.cpp
        src/sheet_dictionary.cpp
        src/sheet_config.cpp
        "${OPENOMR_FONT_SOURCE}"
)

target_include_directories(
        openOmr_core
        PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
        PRIVATE
        "${OPENOMR_FONT_DIR}"
)

target_link_libraries(
        openOmr_core
        PUBLIC
        ${OpenCV_LIBS}
)

set_target_properties(
        openOmr_core
        PROPERTIES
        CXX_VISIBILITY_PRESET hidden
        VISIBILITY_INLINES_HIDDEN YES
)

if(EMSCRIPTEN)
    target_compile_options(openOmr_core PRIVATE -Oz -flto -fexceptions)
endif()