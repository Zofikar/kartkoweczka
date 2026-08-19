# Classes and methods whitelist

core = {
    '': [
        'mean',
    ],
    'Algorithm': [],
}

imgproc = {
    '': [
        'cvtColor',
    ]
}

objdetect = {
    '': [
        'getPredefinedDictionary',
    ],

    'GraphicalCodeDetector': [
        'detectAndDecode',
        'detectAndDecodeMulti',
    ],

    'aruco_PredefinedDictionaryType': [],

    'aruco_Dictionary': [
        'Dictionary',
    ],

    'aruco_DetectorParameters': [
        'DetectorParameters',
    ],

    'aruco_RefineParameters': [
        'RefineParameters',
    ],

    'aruco_ArucoDetector': [
        'ArucoDetector',
        'detectMarkers',
    ],

    'QRCodeDetectorAruco_Params': [
        'Params',
    ],

    'QRCodeDetectorAruco': [
        'QRCodeDetectorAruco',
        'detectAndDecode',
        'detectAndDecodeMulti',
        'setDetectorParameters',
        'setArucoParameters',
    ],
}


white_list = makeWhiteList([core, imgproc, objdetect])
