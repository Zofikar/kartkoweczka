declare module 'js-aruco' {
	export interface ArucoPoint {
		x: number;
		y: number;
	}

	export interface ArucoMarker {
		id: number;
		corners: ArucoPoint[];
	}

	export interface CvImage {
		width: number;
		contours?: ArucoPoint[][];
		height: number;
		data: number[];
	}

	export namespace CV {
		function grayscale(source: ImageData, destination: CvImage): void;
		function adaptiveThreshold(
			source: CvImage,
			destination: CvImage,
			kernelSize: number,
			threshold: number
		): void;
		function findContours(image: CvImage, binary: unknown[]): ArucoPoint[][];
	}

	export namespace AR {
		class Detector {
			grey: CvImage;
			thres: CvImage;
			binary: unknown[];
			contours: ArucoPoint[][];
			candidates: ArucoPoint[][];

			detect(image: ImageData): ArucoMarker[];
			findCandidates(
				contours: ArucoPoint[][],
				minSize: number,
				epsilon: number,
				minLength: number
			): ArucoPoint[][];
			clockwiseCorners(candidates: ArucoPoint[][]): ArucoPoint[][];
			notTooNear(candidates: ArucoPoint[][], minDist: number): ArucoPoint[][];
			findMarkers(image: CvImage, candidates: ArucoPoint[][], warpSize: number): ArucoMarker[];
		}
	}
}
