set(CMAKE_BUILD_TYPE Release CACHE STRING "")

set(BUILD_SHARED_LIBS OFF CACHE BOOL "")

set(BUILD_TESTS OFF CACHE BOOL "")
set(BUILD_PERF_TESTS OFF CACHE BOOL "")
set(BUILD_EXAMPLES OFF CACHE BOOL "")
set(BUILD_opencv_apps OFF CACHE BOOL "")
set(BUILD_opencv_freetype ON CACHE BOOL "" FORCE)
set(BUILD_DOCS OFF CACHE BOOL "")
set(BUILD_PACKAGE OFF CACHE BOOL "")

set(
        BUILD_LIST
        "core,imgproc,objdetect,freetype"
        CACHE STRING ""
)

# Keep non-free algorithms disabled
set(OPENCV_ENABLE_NONFREE OFF CACHE BOOL "")

# ------------------------------------------------------------
# CPU / acceleration backends we do not need
# ------------------------------------------------------------

set(WITH_IPP OFF CACHE BOOL "")
set(BUILD_IPP_IW OFF CACHE BOOL "")

set(WITH_ITT OFF CACHE BOOL "")
set(BUILD_ITT OFF CACHE BOOL "")

set(WITH_OPENCL OFF CACHE BOOL "")
set(WITH_OPENGL OFF CACHE BOOL "")
set(WITH_TBB OFF CACHE BOOL "")
set(BUILD_TBB OFF CACHE BOOL "")

set(WITH_PTHREADS_PF OFF CACHE BOOL "")

# ------------------------------------------------------------
# Image codecs we do not use
# We operate directly on decoded pixel buffers / cv::Mat
# ------------------------------------------------------------

set(WITH_TIFF OFF CACHE BOOL "")
set(BUILD_TIFF OFF CACHE BOOL "")

set(WITH_JPEG OFF CACHE BOOL "")
set(BUILD_JPEG OFF CACHE BOOL "")

set(WITH_PNG OFF CACHE BOOL "")
set(BUILD_PNG OFF CACHE BOOL "")

set(WITH_WEBP OFF CACHE BOOL "")
set(BUILD_WEBP OFF CACHE BOOL "")

set(WITH_JASPER OFF CACHE BOOL "")
set(BUILD_JASPER OFF CACHE BOOL "")

set(WITH_OPENJPEG OFF CACHE BOOL "")
set(BUILD_OPENJPEG OFF CACHE BOOL "")

set(WITH_OPENEXR OFF CACHE BOOL "")
set(BUILD_OPENEXR OFF CACHE BOOL "")

# ------------------------------------------------------------
# Video / camera stack
# Explicitly disabled to minimize dependencies and license surface
# ------------------------------------------------------------

set(WITH_FFMPEG OFF CACHE BOOL "")
set(WITH_GSTREAMER OFF CACHE BOOL "")
set(WITH_V4L OFF CACHE BOOL "")
set(WITH_DSHOW OFF CACHE BOOL "")
set(WITH_MSMF OFF CACHE BOOL "")
set(WITH_AVFOUNDATION OFF CACHE BOOL "")
set(WITH_1394 OFF CACHE BOOL "")
set(WITH_GPHOTO2 OFF CACHE BOOL "")
set(WITH_OBSENSOR OFF CACHE BOOL "")
set(OBSENSOR_USE_ORBBEC_SDK OFF CACHE BOOL "")

# ------------------------------------------------------------
# Other unnecessary third-party / language integrations
# ------------------------------------------------------------

set(BUILD_JAVA OFF CACHE BOOL "")
set(BUILD_opencv_java OFF CACHE BOOL "")
set(BUILD_opencv_js OFF CACHE BOOL "")

set(WITH_OPENVINO OFF CACHE BOOL "")
set(BUILD_PROTOBUF OFF CACHE BOOL "")

set(WITH_ADE OFF CACHE BOOL "")
set(BUILD_ADE OFF CACHE BOOL "")