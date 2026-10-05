add_executable(
        openOmr_wasm
        src/generated/bind.cpp
        src/generated/glue.cpp
        src/conversions.cpp
        src/bytes.cpp
)

target_include_directories(
        openOmr_wasm
        PUBLIC
        include/
)

target_link_libraries(
        openOmr_wasm
        PRIVATE
        openOmr_core
        embind
        ${OpenCV_LIBS}
)

target_link_directories(
        openOmr_wasm
        PRIVATE
        /opt/wasm-font-deps/lib
)

set_target_properties(
        openOmr_wasm
        PROPERTIES
        OUTPUT_NAME openOmr
        SUFFIX ".js"
)

target_compile_options(
        openOmr_wasm
        PRIVATE
        "-Oz"
        "-flto"
        "-fexceptions"
)

target_link_options(
        openOmr_wasm
        PRIVATE
        "-Oz"
        "-flto"
        "-msimd128"
        "-sALLOW_MEMORY_GROWTH=1"
        "-sFILESYSTEM=0"
        "-sMALLOC=emmalloc"
        "-sMODULARIZE=1"
        "-sEXPORT_ES6=1"
        "-fexceptions"
        "--emit-tsd"
        "${CMAKE_CURRENT_BINARY_DIR}/openOmr.d.ts"
)