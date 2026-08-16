import { arucoMarkerMatrix } from 'aruco-marker';

const FIXED_ORIENTATION_IDS = [37, 336, 575];
const FORMAT_VERSION_IDS = [79, 426, 837, 896, 382, 224];
const SELECTED_IDS = [...FIXED_ORIENTATION_IDS, ...FORMAT_VERSION_IDS];

const MINIMUM_WHITE_CELLS = 8;
const MAXIMUM_WHITE_CELLS = 17;
const MINIMUM_TRANSITIONS = 8;
const MAXIMUM_TRANSITIONS = 18;
const MINIMUM_ROTATIONAL_DISTANCE = 10;

validateMarkerMetrics();
validatePairwiseDistances();
console.log(`Validated ${SELECTED_IDS.length} robust ARUCO_ORIGINAL marker ids.`);

function validateMarkerMetrics() {
	for (const markerId of SELECTED_IDS) validateMarker(markerId);
}

function validateMarker(markerId) {
	const matrix = markerMatrix(markerId);
	const whiteCells = matrix.flat().reduce((total, cell) => total + cell, 0);
	const transitions = transitionCount(matrix);
	const rotationalDistance = minimumSelfRotationDistance(matrix);

	assertInRange(`${markerId} white cells`, whiteCells, MINIMUM_WHITE_CELLS, MAXIMUM_WHITE_CELLS);
	assertInRange(`${markerId} transitions`, transitions, MINIMUM_TRANSITIONS, MAXIMUM_TRANSITIONS);
	assertAtLeast(`${markerId} rotational distance`, rotationalDistance, MINIMUM_ROTATIONAL_DISTANCE);
}

function validatePairwiseDistances() {
	for (let leftIndex = 0; leftIndex < SELECTED_IDS.length; leftIndex++) {
		for (let rightIndex = leftIndex + 1; rightIndex < SELECTED_IDS.length; rightIndex++) {
			validateMarkerPair(SELECTED_IDS[leftIndex], SELECTED_IDS[rightIndex]);
		}
	}
}

function validateMarkerPair(leftId, rightId) {
	const distance = minimumRotationalDistance(markerMatrix(leftId), markerMatrix(rightId));
	assertAtLeast(`${leftId}/${rightId} pairwise distance`, distance, MINIMUM_ROTATIONAL_DISTANCE);
}

function markerMatrix(markerId) {
	const columns = arucoMarkerMatrix(markerId);
	return Array.from({ length: 5 }, (_, row) =>
		Array.from({ length: 5 }, (_, column) => columns[column][row])
	);
}

function transitionCount(matrix) {
	return matrixTransitions(matrix) + matrixTransitions(transpose(matrix));
}

function matrixTransitions(matrix) {
	return matrix.reduce(
		(total, row) => total + row.slice(1).filter((cell, index) => cell !== row[index]).length,
		0
	);
}

function minimumSelfRotationDistance(matrix) {
	return Math.min(
		...rotations(matrix)
			.slice(1)
			.map((rotation) => hammingDistance(matrix, rotation))
	);
}

function minimumRotationalDistance(left, right) {
	return Math.min(
		...rotations(left).flatMap((leftRotation) =>
			rotations(right).map((rightRotation) => hammingDistance(leftRotation, rightRotation))
		)
	);
}

function rotations(matrix) {
	const result = [matrix];
	for (let index = 1; index < 4; index++) result.push(rotateClockwise(result[index - 1]));
	return result;
}

function rotateClockwise(matrix) {
	return matrix[0].map((_, column) => matrix.map((row) => row[column]).reverse());
}

function transpose(matrix) {
	return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function hammingDistance(left, right) {
	const rightCells = right.flat();
	return left.flat().reduce((distance, cell, index) => distance + (cell !== rightCells[index]), 0);
}

function assertInRange(label, value, minimum, maximum) {
	if (value < minimum || value > maximum) {
		throw new Error(`${label} must be ${minimum}..${maximum}; received ${value}.`);
	}
}

function assertAtLeast(label, value, minimum) {
	if (value < minimum) throw new Error(`${label} must be at least ${minimum}; received ${value}.`);
}
