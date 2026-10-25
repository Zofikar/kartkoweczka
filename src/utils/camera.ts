type CameraCapabilities = MediaTrackCapabilities & {
	focusMode?: string[];
	exposureMode?: string[];
	whiteBalanceMode?: string[];
	torch?: boolean;
};
type CameraControls = MediaTrackConstraintSet & {
	focusMode?: string;
	exposureMode?: string;
	whiteBalanceMode?: string;
	torch?: boolean;
};

/** One controller per preview. Camera policy is independent of sheet recognition. */
export function createCamera() {
	let video: HTMLVideoElement | undefined;
	let stream: MediaStream | undefined;
	let generation = 0;
	let constraints: MediaTrackConstraints = {};
	let torchSupported = false;
	let changingTorch = false;
	let torch = false;

	function stopCamera() {
		generation++;
		stream?.getTracks().forEach((track) => track.stop());
		stream = undefined;
		if (video) video.srcObject = null;
		torchSupported = false;
		changingTorch = false;
		torch = false;
	}

	function initialize(element: HTMLVideoElement) {
		stopCamera();
		video = element;
		video.muted = true;
		video.playsInline = true;
	}

	async function startCamera(): Promise<boolean> {
		if (!video) throw new Error('Initialize the camera before starting it');
		stopCamera();
		const session = generation;
		const preview = video;
		// Prefer sensor-shaped frames without forcing a crop or a device-specific minimum.
		constraints = {
			facingMode: { ideal: 'environment' },
			width: { ideal: 3200 },
			height: { ideal: 2400 },
			aspectRatio: { ideal: 4 / 3 },
			frameRate: { ideal: 24 },
			...({ resizeMode: 'none' } as MediaTrackConstraints),
		};
		const opened = await navigator.mediaDevices.getUserMedia({ audio: false, video: constraints });
		if (session !== generation) {
			opened.getTracks().forEach((track) => track.stop());
			return false;
		}
		stream = opened;
		try {
			const track = opened.getVideoTracks()[0];
			const caps = (track.getCapabilities?.() ?? {}) as CameraCapabilities;
			torchSupported = caps.torch === true;
			const advanced: CameraControls[] = [];
			for (const mode of ['focusMode', 'exposureMode', 'whiteBalanceMode'] as const) {
				if (caps[mode]?.includes('continuous')) advanced.push({ [mode]: 'continuous' });
			}
			constraints = { ...constraints, advanced };
			if (advanced.length) {
				try {
					await track.applyConstraints(constraints);
				} catch {
					if (session !== generation) return false;
					// Optional controls must never prevent a working preview.
					constraints = track.getConstraints();
				}
			}
			if (session !== generation) return false;
			preview.srcObject = opened;
			await preview.play();
			return session === generation;
		} catch (error) {
			if (session !== generation) return false;
			stopCamera();
			throw error;
		}
	}

	/** Explicit lighting feedback; no brightness guesses or automatic torch oscillation. */
	async function feedback({ torch: enabled }: { torch: boolean }): Promise<boolean> {
		const track = stream?.getVideoTracks()[0];
		if (!track || !torchSupported || changingTorch) return false;
		if (enabled === torch) return true;
		const session = generation;
		changingTorch = true;
		const next = {
			...constraints,
			advanced: [
				...(constraints.advanced ?? []).filter((set) => !('torch' in set)),
				{ torch: enabled } as CameraControls,
			],
		};
		try {
			await track.applyConstraints(next);
			if (session !== generation) return false;
			constraints = next;
			torch = enabled;
			return true;
		} catch {
			return false;
		} finally {
			if (session === generation) changingTorch = false;
		}
	}

	return { initialize, startCamera, stopCamera, feedback };
}
