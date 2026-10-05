<script lang="ts">
	import {
		scanGradingSheetImage,
		scanGradingSheetImageData,
		checkImageQuality,
		computeScore,
		type OmrScanResult,
	} from '@/utils/omrScanner';
	import { getOpenOmr } from '@/utils/openOmr';
	import { getTest, getTestRevision } from '@/db/repositories';
	import Button from '$lib/ui/Button.svelte';
	import { tick } from 'svelte';
	import { p } from '@/router';
	import { i18n } from '@/lib/i18n.svelte';

	type Mode = 'image' | 'camera';
	type CameraState = 'idle' | 'searching' | 'processing' | 'result' | 'error';
	type ImageState = 'idle' | 'analyzing' | 'result' | 'error';

	let mode = $state<Mode>('image');
	let imageState = $state<ImageState>('idle');
	let cameraState = $state<CameraState>('idle');
	let result = $state<OmrScanResult | null>(null);
	let errorMessage = $state('');
	let statusLabel = $state('');

	let videoElement = $state<HTMLVideoElement>();
	let stream = $state<MediaStream | null>(null);
	let searchAnimationId = $state<number>(0);
	let torch = $state(false);
	let fileInput: HTMLInputElement;
	const busy = $derived(
		imageState === 'analyzing' || cameraState === 'searching' || cameraState === 'processing'
	);

	function choosePhoto() {
		fileInput.value = '';
		fileInput.click();
	}

	async function openCamera() {
		switchMode('camera');
		await startCamera();
	}

	function resetResults() {
		result = null;
		errorMessage = '';
		statusLabel = '';
	}

	function cancelCamera() {
		stopCamera();
		resetResults();
		cameraState = 'idle';
	}

	function switchMode(newMode: Mode) {
		stopCamera();
		resetResults();
		imageState = 'idle';
		cameraState = 'idle';
		mode = newMode;
	}

	$effect(() => {
		return () => {
			stopCamera();
		};
	});

	// ─── Image mode ───────────────────────────────────────────────────────────

	async function handleImageFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		switchMode('image');
		resetResults();
		imageState = 'analyzing';
		statusLabel = i18n.t('scanner.analyzing');

		try {
			result = await scanAndScoreImage(file);
			imageState = 'result';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			imageState = 'error';
		}
	}

	async function scanAndScoreImage(file: File): Promise<OmrScanResult> {
		const scan = await scanGradingSheetImage(file);
		const revisionId = scan.qrCode.metadata!.revisionId;

		statusLabel = i18n.t('scanner.loadingRevision');
		const revision = await getTestRevision(revisionId);
		if (!revision) throw new Error(i18n.t('scanner.unknownRevision'));

		const test = await getTest(revision.testId);
		const testName = test?.name ?? i18n.t('scanner.unknownTest');

		statusLabel = i18n.t('scanner.scanningAnswers');
		const score = computeScore(scan.scannedAnswers, revision.content);
		return {
			scanStatus: 'success',
			revisionId,
			testId: revision.testId,
			testName,
			revisionName: revision.name,
			scannedAnswers: scan.scannedAnswers,
			correctAnswers: score.correctAnswers,
			correctAnswerIndices: score.correctAnswerIndices,
			responseLabels: score.responseLabels,
			score: score.score,
			totalQuestions: score.totalQuestions,
			normalizedImage: scan.normalizedImage,
		};
	}

	// ─── Camera mode ──────────────────────────────────────────────────────────

	type NumericCapability = {
		min: number;
		max: number;
		step: number;
	};

	type ExtendedMediaTrackCapabilities = MediaTrackCapabilities & {
		contrast?: NumericCapability;
		sharpness?: NumericCapability;
		saturation?: NumericCapability;
		focusMode?: string[];
		exposureMode?: string[];
		exposureCompensation?: NumericCapability;
	};

	type ExtendedMediaTrackConstraintSet = MediaTrackConstraintSet & {
		contrast?: number;
		sharpness?: number;
		saturation?: number;
		focusMode?: string;
		exposureMode?: string;
		exposureCompensation?: number;
	};

	async function startCamera() {
		resetResults();
		cameraState = 'searching';
		statusLabel = i18n.t('scanner.searching');
		await tick();

		try {
			stream = await openPortraitCameraStream();
		} catch {
			errorMessage = i18n.t('scanner.cameraUnavailable');
			cameraState = 'error';
			return;
		}
		if (!videoElement) {
			stopCamera();
			return;
		}

		const track = stream.getVideoTracks()[0];
		const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;

		const advanced: ExtendedMediaTrackConstraintSet = {};

		if (caps.contrast) {
			advanced.contrast = caps.contrast.min + (caps.contrast.max - caps.contrast.min) * 0.6;
		}

		if (caps.sharpness) {
			advanced.sharpness = caps.sharpness.min + (caps.sharpness.max - caps.sharpness.min) * 0.4;
		}

		if (caps.saturation) {
			advanced.saturation = caps.saturation.min;
		}

		if (caps.focusMode?.includes('continuous')) {
			advanced.focusMode = 'continuous';
		}

		if (caps.exposureMode?.includes('continuous')) {
			advanced.exposureMode = 'continuous';
		}

		try {
			if (Object.keys(advanced).length > 0) {
				await track.applyConstraints({
					advanced: [advanced],
				});
			}
		} catch (error) {
			// Camera still works; only enhancement failed.
			console.warn('Camera enhancement constraints rejected:', error);
		}

		videoElement.srcObject = stream;
		await videoElement.play();
		requestAnimationFrame(searchFrame);
	}

	async function openPortraitCameraStream(): Promise<MediaStream> {
		const portraitConstraints: MediaStreamConstraints = {
			video: {
				facingMode: { ideal: 'environment' },
				width: { ideal: 3000, min: 720 },
				aspectRatio: { ideal: 3 / 4 },
				/* @ts-expect-error resize mode exists */
				resizeMode: 'none',
			},
		};
		try {
			return await navigator.mediaDevices.getUserMedia(portraitConstraints);
		} catch {
			return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
		}
	}

	function stopCamera() {
		if (searchAnimationId) cancelAnimationFrame(searchAnimationId);
		searchAnimationId = 0;
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			stream = null;
		}
		if (videoElement) videoElement.srcObject = null;
	}

	async function setTorch(enabled: boolean): Promise<boolean> {
		if (enabled === torch) return true;
		if (!stream) return false;

		const track = stream.getVideoTracks()[0];
		try {
			await track.applyConstraints({
				advanced: [{ torch: true }],
			} as ExtendedMediaTrackConstraintSet);
		} catch {
			return false;
		}
		torch = enabled;
		return true;
	}

	async function searchFrame() {
		if (cameraState !== 'searching' || !videoElement || videoElement.readyState < 2) {
			searchAnimationId = requestAnimationFrame(searchFrame);
			return;
		}
		searchAnimationId = 0;

		try {
			const canvas = new OffscreenCanvas(videoElement.videoWidth, videoElement.videoHeight);
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(videoElement, 0, 0);
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

			statusLabel = i18n.t('scanner.scanningAnswers');
			const openOmr = await getOpenOmr();
			const quality = await checkImageQuality(imageData);
			if (quality.value === openOmr.ImageQuality.TooDark.value) await setTorch(true);
			if (quality.value === openOmr.ImageQuality.TooBright.value) await setTorch(false);

			const scan = await scanGradingSheetImageData(imageData);
			cameraState = 'processing';
			stopCamera();
			statusLabel = i18n.t('scanner.processing');
			result = await processFrozenFrame(scan);
			cameraState = 'result';
		} catch {
			scheduleNextFrame();
		}
	}

	function scheduleNextFrame() {
		searchAnimationId = requestAnimationFrame(() => {
			searchAnimationId = 0;
			searchFrame();
		});
	}

	async function processFrozenFrame(
		scan: Awaited<ReturnType<typeof scanGradingSheetImageData>>
	): Promise<OmrScanResult> {
		const revisionId = scan.qrCode.metadata!.revisionId;
		const revision = await getTestRevision(revisionId);
		if (!revision) throw new Error(i18n.t('scanner.unknownRevision'));

		const test = await getTest(revision.testId);
		const testName = test?.name ?? i18n.t('scanner.unknownTest');

		const score = computeScore(scan.scannedAnswers, revision.content);

		return {
			scanStatus: 'success',
			revisionId,
			testId: revision.testId,
			testName,
			revisionName: revision.name,
			scannedAnswers: scan.scannedAnswers,
			correctAnswers: score.correctAnswers,
			correctAnswerIndices: score.correctAnswerIndices,
			responseLabels: score.responseLabels,
			score: score.score,
			totalQuestions: score.totalQuestions,
			normalizedImage: scan.normalizedImage,
		};
	}

	function retry() {
		resetResults();
		if (mode === 'camera') cameraState = 'idle';
		else imageState = 'idle';
	}

	function answerLabel(index: number): string {
		return String.fromCharCode(65 + index);
	}
</script>

<div class="page">
	<h1 class="page-title">{i18n.t('scanner.title')}</h1>

	<div class="scan-actions">
		<Button size="lg" disabled={busy} onclick={choosePhoto}>{i18n.t('scanner.upload')}</Button>
		<Button size="lg" disabled={busy} onclick={openCamera}>{i18n.t('scanner.startCamera')}</Button>
	</div>
	<input bind:this={fileInput} type="file" accept="image/*" hidden onchange={handleImageFile} />

	<!-- Image mode -->
	{#if mode === 'image'}
		<div class="section">
			{#if imageState === 'analyzing'}
				<div class="status-box">
					<div class="spinner"></div>
					<p>{statusLabel}</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Camera mode -->
	{#if mode === 'camera'}
		<div class="section">
			{#if cameraState === 'searching'}
				<div class="video-wrapper">
					<video bind:this={videoElement} autoplay playsinline muted class="video-preview"></video>
					<div class="video-overlay">
						<div class="spinner"></div>
						<p>{statusLabel}</p>
					</div>
				</div>
				<Button variant="outline" onclick={cancelCamera}>{i18n.t('scanner.cancel')}</Button>
			{/if}
			{#if cameraState === 'processing'}
				<div class="status-box">
					<div class="spinner"></div>
					<p>{statusLabel}</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Error display (both modes) -->
	{#if errorMessage && (imageState === 'error' || cameraState === 'error')}
		<div class="error-box">
			<p class="error-text">{errorMessage}</p>
			<Button variant="outline" onclick={retry}>{i18n.t('common.tryAgain')}</Button>
		</div>
	{/if}

	<!-- Result display -->
	{#if result && (imageState === 'result' || cameraState === 'result')}
		<div class="result-card">
			<div class="result-meta">
				<p>
					{i18n.t('scanner.test')}
					<a href={p('/tests/:id', { params: { id: result.testId } })} class="meta-link">
						{result.testName}
					</a>
				</p>
				<p>
					{i18n.t('scanner.revision')}
					<a
						href={p('/tests/:id/revision/:revisionId', {
							params: { id: result.testId, revisionId: result.revisionId },
						})}
						class="meta-link">{result.revisionName}</a
					>
				</p>
			</div>
			<div class="score-row">
				<h2>{i18n.t('scanner.score', { score: result.score, total: result.totalQuestions })}</h2>
				<p class="percentage">
					{Math.round((result.score / Math.max(1, result.totalQuestions)) * 100)}%
				</p>
				<Button size="sm" variant="outline" onclick={retry}>{i18n.t('scanner.scanAgain')}</Button>
			</div>

			<table class="answers-table">
				<thead>
					<tr>
						<th>#</th>
						<th>{i18n.t('scanner.answer')}</th>
						<th>{i18n.t('scanner.correctAnswer')}</th>
						<th>{i18n.t('scanner.correct')}</th>
					</tr>
				</thead>
				<tbody>
					{#each result.scannedAnswers as scanned, i (i)}
						{@const isCorrect = result.correctAnswers[i]}
						{@const correctIdx = result.correctAnswerIndices[i]}
						<tr class:correct={isCorrect} class:incorrect={!isCorrect}>
							<td>{result.responseLabels[i]}</td>
							<td class:empty={scanned < 0}>
								{scanned >= 0 ? answerLabel(scanned) : '—'}
							</td>
							<td>{correctIdx >= 0 ? answerLabel(correctIdx) : '—'}</td>
							<td>
								{#if isCorrect}
									<span class="check">✅</span>
								{:else}
									<span class="cross">❌</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: var(--space-4);
		max-width: 640px;
		margin: 0 auto;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 var(--space-4);
	}

	.scan-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.section {
		margin-bottom: var(--space-4);
	}

	.video-wrapper {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: #000;
	}

	.video-preview {
		display: block;
		width: fit-content;
		max-height: 60vh;
		object-fit: cover;
	}

	.video-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		gap: var(--space-3);
	}

	.status-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-6);
		color: var(--text-muted);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--background-muted);
		border-top-color: var(--secondary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Error */
	.error-box {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
		text-align: center;
	}

	.error-text {
		color: var(--error);
		margin: 0 0 var(--space-3);
	}

	/* Result */
	.result-meta {
		margin-bottom: var(--space-4);
	}

	.result-meta p {
		margin: 0 0 var(--space-1);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.meta-link {
		color: var(--secondary);
		text-decoration: none;
		font-weight: 600;
	}

	.meta-link:hover {
		text-decoration: underline;
	}

	.result-card {
		border: 1px solid var(--background-muted);
		border-radius: var(--radius-lg);
		background: var(--background-muted);
		padding: var(--space-4);
	}

	.score-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
		flex-wrap: wrap;
	}

	.score-row h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.percentage {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	/* Table */
	.answers-table {
		width: 100%;
		border-collapse: collapse;
	}

	.answers-table th,
	.answers-table td {
		border-bottom: 1px solid var(--background-muted);
		padding: var(--space-2);
		text-align: center;
	}

	.answers-table th:first-child,
	.answers-table td:first-child {
		text-align: left;
		width: 2.5em;
	}

	tr.correct {
		background: rgba(34, 197, 94, 0.06);
	}

	tr.incorrect {
		background: rgba(239, 68, 68, 0.04);
	}

	td.empty {
		color: var(--text-muted);
	}

	.check,
	.cross {
		font-size: 1.125rem;
	}
</style>
