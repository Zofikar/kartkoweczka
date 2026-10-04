#include <openOmr/api.h>

#include <cassert>
#include <iostream>
#include <string>

int main()
{
    std::string const metadata{"opaque\0metadata", 15};
    auto const qr = OpenOmr::generateQr(metadata, {256, 256});
    assert(!qr.empty());

    cv::Mat canvas(400, 500, CV_8UC1, cv::Scalar(255));
    qr.copyTo(canvas(cv::Rect(120, 80, qr.cols, qr.rows)));
    auto const detections = OpenOmr::detectQrCode(
        canvas, cv::Rect(100, 60, 300, 300));
    assert(detections.size() == 1);
    assert(detections.front().data == metadata);
    assert(detections.front().tl.x >= 100);
    assert(detections.front().tl.y >= 60);

    cv::Mat dark(100, 100, CV_8UC1, cv::Scalar(5));
    cv::Mat bright(100, 100, CV_8UC1, cv::Scalar(255));
    cv::Mat good(100, 100, CV_8UC1, cv::Scalar(150));
    assert(OpenOmr::checkImageQuality(dark) == OpenOmr::ImageQuality::TooDark);
    assert(OpenOmr::checkImageQuality(bright) == OpenOmr::ImageQuality::TooBright);
    assert(OpenOmr::checkImageQuality(good) == OpenOmr::ImageQuality::Good);

    std::cout << "QR and image quality tests passed\n";
}
