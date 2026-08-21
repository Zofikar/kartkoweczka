#include <opencv2/core.hpp>
#include <opencv2/objdetect.hpp>
#include <emscripten/bind.h>

cv::Mat encodeQRCode(
    const std::string& text,
    int correctionLevel
) {
    cv::QRCodeEncoder::Params params;

    params.correction_level =
        static_cast<cv::QRCodeEncoder::CorrectionLevel>(
            correctionLevel
        );

    params.mode = cv::QRCodeEncoder::MODE_AUTO;

    auto encoder = cv::QRCodeEncoder::create(params);

    cv::Mat output;
    encoder->encode(text, output);

    return output;
}

EMSCRIPTEN_BINDINGS(opencv_qr_encoder_shim) {
    emscripten::function(
        "encodeQRCode",
        &encodeQRCode
    );
}