FROM emscripten/emsdk:6.0.8 AS builder

ARG OPENCV_VERSION=4.14.0
ARG FREETYPE_VERSION=VER-2-13-3
ARG HARFBUZZ_VERSION=10.2.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    git \
    ca-certificates \
    gdb \
    pkg-config \
    libfreetype-dev \
    libharfbuzz-dev \
    && rm -rf /var/lib/apt/lists/*


# ------------------------------------------------------------
# Download OpenCV source once
# ------------------------------------------------------------

RUN git clone \
    --branch ${OPENCV_VERSION} \
    --depth 1 \
    https://github.com/opencv/opencv.git \
    /opt/opencv-src

RUN git clone \
    --branch ${OPENCV_VERSION} \
    --depth 1 \
    https://github.com/opencv/opencv_contrib.git \
    /opt/opencv-contrib-src

# FreeType and HarfBuzz must be compiled with Emscripten; native Debian
# libraries cannot be linked into the Wasm OpenCV build.
RUN git clone --branch ${FREETYPE_VERSION} --depth 1 \
        https://gitlab.freedesktop.org/freetype/freetype.git /opt/freetype-src \
    && emcmake cmake -S /opt/freetype-src -B /tmp/freetype-wasm-build -G Ninja \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/opt/wasm-font-deps \
        -DBUILD_SHARED_LIBS=OFF \
        -DFT_DISABLE_ZLIB=ON \
        -DFT_DISABLE_BZIP2=ON \
        -DFT_DISABLE_PNG=ON \
        -DFT_DISABLE_HARFBUZZ=ON \
        -DFT_DISABLE_BROTLI=ON \
    && cmake --build /tmp/freetype-wasm-build --parallel \
    && cmake --install /tmp/freetype-wasm-build

RUN git clone --branch ${HARFBUZZ_VERSION} --depth 1 \
        https://github.com/harfbuzz/harfbuzz.git /opt/harfbuzz-src \
    && PKG_CONFIG_LIBDIR=/opt/wasm-font-deps/lib/pkgconfig \
       PKG_CONFIG_PATH=/opt/wasm-font-deps/lib/pkgconfig \
       emcmake cmake -S /opt/harfbuzz-src -B /tmp/harfbuzz-wasm-build -G Ninja \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/opt/wasm-font-deps \
        -DCMAKE_PREFIX_PATH=/opt/wasm-font-deps \
        -DFREETYPE_LIBRARY=/opt/wasm-font-deps/lib/libfreetype.a \
        -DFREETYPE_INCLUDE_DIRS=/opt/wasm-font-deps/include/freetype2 \
        -DCMAKE_CXX_FLAGS="-DHB_NO_PRAGMA_GCC_DIAGNOSTIC_ERROR" \
        -DBUILD_SHARED_LIBS=OFF \
        -DHB_BUILD_UTILS=OFF \
        -DHB_BUILD_SUBSET=OFF \
        -DHB_BUILD_TESTS=OFF \
        -DHB_HAVE_FREETYPE=ON \
        -DHB_HAVE_GLIB=OFF \
        -DHB_HAVE_GOBJECT=OFF \
        -DHB_HAVE_ICU=OFF \
    && cmake --build /tmp/harfbuzz-wasm-build --parallel \
    && cmake --install /tmp/harfbuzz-wasm-build



# ------------------------------------------------------------
# Copy common opencv configuration
# ------------------------------------------------------------

COPY opencv-common.cmake /opt/opencv-common.cmake

# ------------------------------------------------------------
# Build native Linux OpenCV
# ------------------------------------------------------------

RUN cmake \
    -S /opt/opencv-src \
    -B /tmp/opencv-native-build \
    -G Ninja \
    -C /opt/opencv-common.cmake \
    -DCMAKE_INSTALL_PREFIX=/opt/opencv-native \
    -DOPENCV_EXTRA_MODULES_PATH=/opt/opencv-contrib-src/modules \
    \
    && cmake --build /tmp/opencv-native-build --parallel \
    && cmake --install /tmp/opencv-native-build


# ------------------------------------------------------------
# Build WebAssembly OpenCV
# ------------------------------------------------------------

RUN PKG_CONFIG_LIBDIR=/opt/wasm-font-deps/lib/pkgconfig \
    PKG_CONFIG_PATH=/opt/wasm-font-deps/lib/pkgconfig \
    emcmake cmake \
    -S /opt/opencv-src \
    -B /tmp/opencv-wasm-build \
    -G Ninja \
    -C /opt/opencv-common.cmake \
    -DCMAKE_INSTALL_PREFIX=/opt/opencv-wasm \
    -DOPENCV_EXTRA_MODULES_PATH=/opt/opencv-contrib-src/modules \
    -DCMAKE_PREFIX_PATH=/opt/wasm-font-deps \
    \
    -DCPU_BASELINE="" \
    -DCPU_DISPATCH="" \
    -DCV_ENABLE_INTRINSICS=ON \
    \
    -DCMAKE_C_FLAGS="-msimd128" \
    -DCMAKE_CXX_FLAGS="-msimd128" \
    \
    && cmake --build /tmp/opencv-wasm-build --parallel \
    && cmake --install /tmp/opencv-wasm-build


# ------------------------------------------------------------
# Final development image
# ------------------------------------------------------------

FROM emscripten/emsdk:6.0.8

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-yaml \
    python3-fonttools \
    clang \
    cmake \
    ninja-build \
    gdb \
    libfreetype-dev \
    libharfbuzz-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/opencv-native /opt/opencv-native
COPY --from=builder /opt/opencv-wasm /opt/opencv-wasm
COPY --from=builder /opt/wasm-font-deps /opt/wasm-font-deps

WORKDIR /workspace