<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import { i18n } from '@/lib/i18n.svelte';
	import { scanFromDiagnostics, type GradingSheetDiagnostics } from '@/utils/omrScanner';
	import { createLightingPolicy, type CaptureQuality } from '@/utils/captureQuality';
	import { createLiveDetector } from '@/utils/liveDetector';
	import { createCamera } from '@/utils/camera';

	const camera = createCamera();
	const detector = createLiveDetector();
	let video: HTMLVideoElement;
	let active = $state(false);
	let pending = $state(false);
	let torch = $state(false);
	let details = $state('');
	let error = $state('');
	let session = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let diagnostics = $state<GradingSheetDiagnostics | null>(null);
	let quality = $state<CaptureQuality | null>(null);
	let elapsed = $state(0);
	let timings = $state<Record<string, number>>({});
	let telemetryPending = false;
	let debugImages = $state(false);
	let lastImageUpload = 0;
	let normalizedPreview: HTMLCanvasElement;
	let qrPreview: HTMLCanvasElement;

	let lighting = createLightingPolicy();
	let overlay: HTMLCanvasElement;

	async function analyze(current: number) {
		if (current !== session || !active) return;
		let delay = 100;
		try {
			if (video.readyState >= 2 && video.videoWidth > 0) {
				const inspect = debugImages;
				const result = await detector.analyze(video, i18n.locale, inspect);
				if (current !== session || !result) return;
				const detected = result.diagnostics;
				const frame = detected.imageData;
				diagnostics = detected;
				quality = result.quality;
				elapsed = result.duration;
				timings = result.timings;
				if (debugImages && detected.normalizedImage) {
					const normalized = detected.normalizedImage;
					normalizedPreview.width = normalized.width;
					normalizedPreview.height = normalized.height;
					normalizedPreview.getContext('2d')!.putImageData(normalized, 0, 0);
					const region = detected.overlayRects?.find((rect) => rect.kind === 'qr');
					if (region) {
						qrPreview.width = region.width;
						qrPreview.height = region.height;
						qrPreview
							.getContext('2d')!
							.drawImage(
								normalizedPreview,
								region.x,
								region.y,
								region.width,
								region.height,
								0,
								0,
								region.width,
								region.height
							);
					}
					// Crop first: annotations must never contaminate the decoder input preview.
					const drawing = normalizedPreview.getContext('2d')!;
					drawing.lineWidth = 5;
					drawing.font = '26px sans-serif';
					for (const rect of detected.overlayRects ?? []) {
						if (!['marker', 'missing', 'qr'].includes(rect.kind)) continue;
						drawing.strokeStyle = rect.kind === 'qr' ? '#ffb300' : '#00b8ff';
						drawing.setLineDash([12, 8]);
						drawing.strokeRect(rect.x, rect.y, rect.width, rect.height);
						drawing.fillStyle = drawing.strokeStyle;
						drawing.fillText(
							`EXPECTED ${rect.label}`,
							Math.max(8, rect.x),
							Math.max(30, rect.y - 10)
						);
					}
					drawing.setLineDash([]);
					drawing.strokeStyle = '#ff4081';
					drawing.fillStyle = '#ff4081';
					for (const marker of detected.normalizedMarkers ?? []) {
						drawing.beginPath();
						marker.corners.forEach((point, index) =>
							index ? drawing.lineTo(point.x, point.y) : drawing.moveTo(point.x, point.y)
						);
						drawing.closePath();
						drawing.stroke();
						drawing.fillText(`ACTUAL ${marker.id}`, marker.center.x, marker.center.y + 40);
					}
				} else {
					normalizedPreview
						.getContext('2d')
						?.clearRect(0, 0, normalizedPreview.width, normalizedPreview.height);
					qrPreview.getContext('2d')?.clearRect(0, 0, qrPreview.width, qrPreview.height);
				}
				if (
					import.meta.env.DEV &&
					!telemetryPending &&
					inspect === debugImages &&
					(!inspect ||
						(detected.normalizedImage &&
							detected.overlayRects?.some((rect) => rect.kind === 'qr') &&
							performance.now() - lastImageUpload >= 3000))
				) {
					telemetryPending = true;
					if (inspect) lastImageUpload = performance.now();
					void fetch(
						`${import.meta.env.BASE_URL}__debug/${inspect ? 'camera-images' : 'camera-timings'}`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(
								inspect
									? {
											normalized: normalizedPreview.toDataURL('image/png'),
											qr: qrPreview.toDataURL('image/png'),
											readable: !!scanFromDiagnostics(detected),
											torch,
										}
									: {
											duration: result.duration,
											timings: result.timings,
											width: frame.width,
											height: frame.height,
											markers: detected.markers.length,
											readable: !!scanFromDiagnostics(detected),
											torch,
										}
							),
							signal: AbortSignal.timeout(5000),
						}
					)
						.catch(() => {})
						.finally(() => {
							telemetryPending = false;
						});
				}
				overlay.width = frame.width;
				overlay.height = frame.height;
				const draw = overlay.getContext('2d')!;
				draw.strokeStyle = '#00e676';
				draw.fillStyle = '#00e676';
				draw.lineWidth = Math.max(2, frame.width / 500);
				draw.font = `${Math.max(20, frame.width / 60)}px sans-serif`;
				for (const marker of detected.markers) {
					draw.beginPath();
					marker.corners.forEach((point, index) =>
						index ? draw.lineTo(point.x, point.y) : draw.moveTo(point.x, point.y)
					);
					draw.closePath();
					draw.stroke();
					draw.fillText(String(marker.id), marker.center.x, marker.center.y);
				}
				const requested = lighting.next(quality, !!scanFromDiagnostics(detected), torch);
				if (requested !== undefined) {
					const applied = await camera.feedback({ torch: requested });
					if (current !== session) return;
					if (applied) {
						torch = requested;
						lighting.applied();
						delay = 1500;
					}
				}
			}
		} catch (cause) {
			if (current === session) error = String(cause);
		} finally {
			if (current === session && active) timer = setTimeout(() => void analyze(current), delay);
		}
	}

	onMount(() => {
		detector.preload(i18n.locale);
		camera.initialize(video);
		return () => {
			stop();
			detector.stop(true);
		};
	});

	function stop() {
		session++;
		clearTimeout(timer);
		diagnostics = null;
		quality = null;
		if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
		detector.stop();
		camera.stopCamera();
		active = false;
		pending = false;
		torch = false;
	}

	async function start() {
		const current = ++session;
		pending = true;
		error = '';
		lighting = createLightingPolicy();
		try {
			const started = await camera.startCamera();
			if (current !== session) return;
			active = started;
			if (started) timer = setTimeout(() => void analyze(current), 0);
			const stream = video.srcObject as MediaStream | null;
			const track = stream?.getVideoTracks()[0];
			details = JSON.stringify(
				{
					settings: track?.getSettings(),
					capabilities: track?.getCapabilities?.(),
				},
				null,
				2
			);
		} catch (cause) {
			if (current === session) error = String(cause);
		} finally {
			if (current === session) pending = false;
		}
	}

	async function toggleTorch() {
		const current = session;
		lighting.manual();
		const enabled = !torch;
		const applied = await camera.feedback({ torch: enabled });
		if (current !== session) return;
		if (applied) torch = enabled;
		else error = i18n.t('cameraDebug.torchUnavailable');
	}

	function saveFrame() {
		if (video.readyState < 2) return;
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')!.drawImage(video, 0, 0);
		canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `camera-${canvas.width}x${canvas.height}.png`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}, 'image/png');
	}
</script>

<section class="camera-debug">
	<h1>{i18n.t('cameraDebug.title')}</h1>
	<p>{i18n.t('cameraDebug.description')}</p>
	<div class="actions">
		<Button onclick={start} disabled={active || pending}>{i18n.t('scanner.startCamera')}</Button>
		<Button onclick={stop} disabled={!active && !pending}>{i18n.t('scanner.cancel')}</Button>
		<Button onclick={toggleTorch} disabled={!active}
			>{i18n.t(torch ? 'cameraDebug.torchOff' : 'cameraDebug.torchOn')}</Button
		>
		<Button onclick={saveFrame} disabled={!active}>{i18n.t('cameraDebug.saveFrame')}</Button>
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
	<div class="preview">
		<video bind:this={video} muted playsinline aria-label={i18n.t('cameraDebug.title')}></video>
		<canvas bind:this={overlay} aria-hidden="true"></canvas>
	</div>
	{#if diagnostics}
		<p>
			{i18n.t('cameraDebug.detection', {
				markers: diagnostics.markers.length,
				stage: diagnostics.stages.at(-1) ?? '',
				rows: diagnostics.scannedAnswers?.length ?? 0,
				ms: elapsed,
			})}
		</p>
		<p>{diagnostics.warnings.at(-1) ?? i18n.t('cameraDebug.readable')}</p>
		<pre>{JSON.stringify(
				{
					quality,
					timings,
					analysisSize: `${diagnostics.imageData.width}×${diagnostics.imageData.height}`,
					revision: diagnostics.qrCode?.data,
					answers: diagnostics.scannedAnswers,
					alignment: diagnostics.alignmentDetails,
				},
				null,
				2
			)}</pre>
	{/if}
	<label
		><input type="checkbox" bind:checked={debugImages} />
		{i18n.t('cameraDebug.inspectImages')}</label
	>
	<p>{i18n.t('cameraDebug.imageCost')}</p>
	<p>{i18n.t('cameraDebug.overlayLegend')}</p>
	<div class="diagnostic-images">
		<div>
			<h2>{i18n.t('cameraDebug.normalized')}</h2>
			<canvas class="normalized" bind:this={normalizedPreview}></canvas>
		</div>
		<div>
			<h2>{i18n.t('cameraDebug.qrCrop')}</h2>
			<canvas class="qr-crop" bind:this={qrPreview}></canvas>
		</div>
	</div>
	<pre>{details}</pre>
</section>

<style>
	.camera-debug {
		max-width: 900px;
		margin: 0 auto;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.preview {
		position: relative;
	}
	.preview canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		object-fit: contain;
	}
	video {
		display: block;
		width: 100%;
		max-height: 65vh;
		object-fit: contain;
	}
	.diagnostic-images {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	.normalized {
		width: 260px;
		max-width: 100%;
		height: auto;
	}
	.qr-crop {
		width: 264px;
		max-width: 100%;
		height: auto;
		image-rendering: pixelated;
	}
	pre {
		overflow: auto;
		padding: var(--space-3);
		background: var(--background-muted);
	}
</style>
