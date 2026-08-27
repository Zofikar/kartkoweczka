# Classes and methods whitelist

core = {
    '': [
        'mean',
        'matFromArray',
        'normalize',
    ],
    'Algorithm': [],
}

imgproc = {
    '': [
        'cvtColor',
        'warpPerspective'
    ]
}

objdetect = {
    '': [
        'getPredefinedDictionary',
        'generateImageMarker',
    ],

    'GraphicalCodeDetector': [
        'detectAndDecode',
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
        'setDetectorParameters',
        'setArucoParameters',
    ],
}


white_list = makeWhiteList([core, imgproc, objdetect])
