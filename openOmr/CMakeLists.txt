cmake_minimum_required(VERSION 3.28)
project(openOmr)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(CTest)

if(EMSCRIPTEN)
    set(
            OpenCV_DIR
            "/opt/opencv-wasm/lib/cmake/opencv4"
            CACHE PATH "OpenCV CMake directory"
            FORCE
    )
else()
    set(
            OpenCV_DIR
            "/opt/opencv-native/lib/cmake/opencv4"
            CACHE PATH "OpenCV CMake directory"
            FORCE
    )
endif()

find_package(
        OpenCV REQUIRED
        COMPONENTS
        core
        imgproc
        objdetect
        freetype
)

add_subdirectory(core)

if(EMSCRIPTEN)
    add_subdirectory(wasm)
else()
    add_executable(openOmr_preview main.cpp)
    target_link_libraries(openOmr_preview PRIVATE openOmr_core)
    add_subdirectory(tests)
endif()