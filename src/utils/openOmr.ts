import MainModuleFactory, {
	type Image,
	type MainModule,
	type Vector_Bytes,
} from '@/wasm/openOmr.js';

let modulePromise: Promise<MainModule> | undefined;

export function getOpenOmr(): Promise<MainModule> {
	modulePromise ??= MainModuleFactory();
	return modulePromise;
}

export function toWasmBytes(openOmr: MainModule, source: ArrayLike<number>): Vector_Bytes {
	const bytes = new openOmr.Vector_Bytes();
	for (let index = 0; index < source.length; index++) bytes.push_back(source[index]);
	return bytes;
}

export function uuidToBytes(uuid: string): Uint8Array {
	const hex = uuid.replaceAll('-', '');
	if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error('Nieprawidłowy identyfikator rewizji UUID.');
	return Uint8Array.from({ length: 16 }, (_, index) =>
		Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
	);
}

export function bytesToUuid(bytes: ArrayLike<number>): string {
	if (bytes.length !== 16) throw new Error('Kod rewizji nie zawiera 16 bajtów UUID.');
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20),
	].join('-');
}

export function imageDataToOpenOmrImage(openOmr: MainModule, imageData: ImageData): Image {
	return {
		data: toWasmBytes(openOmr, imageData.data),
		width: imageData.width,
		height: imageData.height,
		layout: openOmr.PixelLayout.RGBA,
	};
}

export function openOmrImageToImageData(openOmr: MainModule, image: Image): ImageData {
	if (image.layout.value === openOmr.PixelLayout.RGBA.value) {
		return new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height);
	}

	const gray = Uint8Array.from(image.data);
	const rgba = new Uint8ClampedArray(image.width * image.height * 4);
	for (let pixel = 0; pixel < gray.length; pixel++) {
		const offset = pixel * 4;
		rgba[offset] = gray[pixel];
		rgba[offset + 1] = gray[pixel];
		rgba[offset + 2] = gray[pixel];
		rgba[offset + 3] = 255;
	}
	return new ImageData(rgba, image.width, image.height);
}

export function imageDataToPngDataUrl(imageData: ImageData): string {
	const canvas = document.createElement('canvas');
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Nie można utworzyć kontekstu canvas 2D.');
	context.putImageData(imageData, 0, 0);
	return canvas.toDataURL('image/png');
}
