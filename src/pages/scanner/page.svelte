<script lang="ts">
	import {
		computeScore,
		diagnoseGradingSheetImageData,
		scanFromDiagnostics,
		scanGradingSheetImage,
		type GradingSheetDiagnostics,
		type GradingSheetScan,
		type OmrScanResult,
	} from '@/utils/omrScanner';
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

	/** Pause between frame analyses; each one copies the full frame into WASM on the main thread. */
	const SCAN_INTERVAL_MS = 400;
	/** Poll interval while the video has no frame to read yet. */
	const VIDEO_POLL_MS = 100;
	/**
	 * A live frame is accepted only when the same answers are read from this many frames in a row.
	 * The first frame where the QR code decodes is often motion-blurred or still out of focus.
	 */
	const STABLE_FRAMES_REQUIRED = 2;
	/** The fixed bottom marker (`MarkerPositioner::FixedBottomId`); every other id is a corner. */
	const FIXED_BOTTOM_MARKER_ID = 31;

	let videoElement = $state<HTMLVideoElement>();
	let stream: MediaStream | null = null;
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	/** Bumped by stopCamera() so async camera work started earlier can tell it was cancelled. */
	let cameraSession = 0;
	let torch = false;
	/** Set once the torch made the frame too bright; from then on it stays off for this session. */
	let torchAutoDisabled = false;
	/** Answers read from the previous frames and how many frames in a row agreed on them. */
	let candidateKey: string | undefined;
	let candidateFrames = 0;
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
			const scan = await scanGradingSheetImage(file);
			result = await scoreScan(scan);
			imageState = 'result';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			imageState = 'error';
		}
	}

	/** Looks up the revision named by the sheet's QR code and grades the scanned rows. */
	async function scoreScan(scan: GradingSheetScan): Promise<OmrScanResult> {
		const revisionId = scan.qrCode.metadata!.revisionId;

		statusLabel = i18n.t('scanner.loadingRevision');
		const revision = await getTestRevision(revisionId);
		if (!revision) throw new Error(i18n.t('scanner.unknownRevision'));

		const test = await getTest(revision.testId);

		// Same labels the sheet was printed with (see PrintTestSheets).
		const score = computeScore(scan.scannedAnswers, revision.content, {
			trueLabel: i18n.t('questions.editor.trueShort'),
			falseLabel: i18n.t('questions.editor.falseShort'),
		});
		return {
			revisionId,
			testId: revision.testId,
			testName: test?.name ?? i18n.t('scanner.unknownTest'),
			revisionName: revision.name,
			...score,
		};
	}

	// ─── Camera mode ──────────────────────────────────────────────────────────

	type ExtendedMediaTrackCapabilities = MediaTrackCapabilities & {
		focusMode?: string[];
		exposureMode?: string[];
		whiteBalanceMode?: string[];
		torch?: boolean;
	};

	type ExtendedMediaTrackConstraintSet = MediaTrackConstraintSet & {
		focusMode?: string;
		exposureMode?: string;
		whiteBalanceMode?: string;
		torch?: boolean;
	};

	/** Frames right after the stream starts are dark while auto exposure settles; don't judge them. */
	const TORCH_WARMUP_MS = 1500;
	/** Consecutive too-dark frames needed before the torch turns on. */
	const DARK_FRAMES_FOR_TORCH = 3;

	/**
	 * Everything the track was opened and tuned with. `applyConstraints` replaces the whole set, so
	 * toggling the torch must re-send it, or the browser may drop focus mode or the resolution.
	 */
	let trackConstraints: MediaTrackConstraints = {};
	let torchSupported = false;
	let streamStartedAt = 0;
	let darkFrames = 0;

	async function startCamera() {
		stopCamera();
		const session = cameraSession;
		resetResults();
		cameraState = 'searching';
		statusLabel = i18n.t('scanner.searching');
		await tick();

		let opened: { stream: MediaStream; constraints: MediaTrackConstraints };
		try {
			opened = await openPortraitCameraStream();
		} catch {
			if (session !== cameraSession) return;
			errorMessage = i18n.t('scanner.cameraUnavailable');
			cameraState = 'error';
			return;
		}
		const newStream = opened.stream;
		// Cancelled (or restarted) while the permission prompt was open: don't leave this camera on.
		if (session !== cameraSession || !videoElement) {
			newStream.getTracks().forEach((t) => t.stop());
			return;
		}
		stream = newStream;

		const track = newStream.getVideoTracks()[0];
		// Not implemented by every browser (e.g. older Firefox).
		const caps = (
			typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}
		) as ExtendedMediaTrackCapabilities;
		torchSupported = caps.torch === true;

		// One set per feature: an advanced set the camera can't satisfy is skipped as a whole.
		// Contrast and sharpness stay at the camera defaults; sharpening halos and clipped
		// contrast skew the fixed dark-pixel threshold used for grading.
		const advanced: ExtendedMediaTrackConstraintSet[] = [];
		if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
		if (caps.exposureMode?.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
		if (caps.whiteBalanceMode?.includes('continuous')) {
			advanced.push({ whiteBalanceMode: 'continuous' });
		}
		trackConstraints = { ...opened.constraints, advanced };

		if (advanced.length > 0) {
			try {
				await track.applyConstraints(trackConstraints);
			} catch (error) {
				if (session !== cameraSession || stream !== newStream) return;
				// Camera still works; only enhancement failed.
				console.warn('Camera enhancement constraints rejected:', error);
				trackConstraints = opened.constraints;
			}
		}

		if (session !== cameraSession) return;
		if (!videoElement) {
			stopCamera();
			return;
		}

		videoElement.srcObject = stream;
		try {
			await videoElement.play();
		} catch (error) {
			// Expected when the camera was stopped mid-start; anything else is a real failure.
			if (session !== cameraSession) return;
			console.error('Camera preview failed to start:', error);
			stopCamera();
			errorMessage = i18n.t('scanner.cameraUnavailable');
			cameraState = 'error';
			return;
		}
		if (session !== cameraSession) return;
		streamStartedAt = performance.now();
		scheduleSearch(0);
	}

	async function openPortraitCameraStream(): Promise<{
		stream: MediaStream;
		constraints: MediaTrackConstraints;
	}> {
		const portrait: MediaTrackConstraints = {
			facingMode: { ideal: 'environment' },
			width: { ideal: 3000, min: 720 },
			aspectRatio: { ideal: 3 / 4 },
			/* @ts-expect-error resize mode exists */
			resizeMode: 'none',
		};
		try {
			return {
				stream: await navigator.mediaDevices.getUserMedia({ video: portrait }),
				constraints: portrait,
			};
		} catch {
			// Without a size hint browsers default to 640×480, too coarse to read the answer boxes.
			const fallback: MediaTrackConstraints = {
				facingMode: { ideal: 'environment' },
				width: { ideal: 1920 },
			};
			return {
				stream: await navigator.mediaDevices.getUserMedia({ video: fallback }),
				constraints: fallback,
			};
		}
	}

	function stopCamera() {
		cameraSession++;
		clearTimeout(searchTimer);
		searchTimer = undefined;
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			stream = null;
		}
		if (videoElement) videoElement.srcObject = null;
		// A new stream always starts with the torch off.
		torch = false;
		torchAutoDisabled = false;
		torchSupported = false;
		trackConstraints = {};
		darkFrames = 0;
		candidateKey = undefined;
		candidateFrames = 0;
	}

	/**
	 * Whether this frame's reading can be trusted. With a corner marker missing the sheet is
	 * normalized by an affine transform, which ignores perspective, so a phone held at an angle
	 * shifts the answer grid. Waits for all four corners and for consecutive frames that agree.
	 */
	function isStableScan(scan: GradingSheetScan): boolean {
		const corners = scan.markers.filter((marker) => marker.id !== FIXED_BOTTOM_MARKER_ID);
		if (corners.length < 4) {
			candidateKey = undefined;
			candidateFrames = 0;
			return false;
		}
		const key = `${scan.qrCode.data}:${scan.scannedAnswers.join(',')}`;
		if (key === candidateKey) {
			candidateFrames++;
		} else {
			candidateKey = key;
			candidateFrames = 1;
		}
		return candidateFrames >= STABLE_FRAMES_REQUIRED;
	}

	async function setTorch(enabled: boolean): Promise<boolean> {
		if (enabled === torch) return true;
		if (!stream || !torchSupported) return false;

		const session = cameraSession;
		const activeStream = stream;
		const track = activeStream.getVideoTracks()[0];
		const advanced = (trackConstraints.advanced ?? []).filter(
			(set: ExtendedMediaTrackConstraintSet) => set.torch === undefined
		);
		const constraints: MediaTrackConstraints = {
			...trackConstraints,
			advanced: [...advanced, { torch: enabled } as ExtendedMediaTrackConstraintSet],
		};
		try {
			await track.applyConstraints(constraints);
		} catch {
			return false;
		}
		// Cancellation or restart may have replaced the track while constraints were pending.
		if (
			session !== cameraSession ||
			stream !== activeStream ||
			stream.getVideoTracks()[0] !== track
		) {
			return false;
		}
		trackConstraints = constraints;
		torch = enabled;
		// Exposure re-settles under the new lighting; frames read so far no longer compare.
		candidateKey = undefined;
		candidateFrames = 0;
		return true;
	}

	/**
	 * Turns the torch on once the scene stays dark after auto exposure settled, and off for good
	 * if that overexposes the sheet — otherwise a borderline scene would toggle it on every frame.
	 * The torch glints off pencil marks, so it is only a last resort.
	 */
	async function adjustTorch(quality: GradingSheetDiagnostics['quality']): Promise<void> {
		if (quality === 'too-bright' && torch) {
			torchAutoDisabled = true;
			await setTorch(false);
			return;
		}
		if (quality !== 'too-dark' || performance.now() - streamStartedAt < TORCH_WARMUP_MS) {
			darkFrames = 0;
			return;
		}
		darkFrames++;
		if (darkFrames >= DARK_FRAMES_FOR_TORCH && !torchAutoDisabled) await setTorch(true);
	}

	function scheduleSearch(delayMs: number) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => void searchFrame(), delayMs);
	}

	function captureFrame(video: HTMLVideoElement): ImageData {
		const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		ctx.drawImage(video, 0, 0);
		return ctx.getImageData(0, 0, canvas.width, canvas.height);
	}

	async function searchFrame() {
		searchTimer = undefined;
		const session = cameraSession;
		if (cameraState !== 'searching') return;
		if (!videoElement || videoElement.readyState < 2) {
			scheduleSearch(VIDEO_POLL_MS);
			return;
		}

		// One pass gives both the image quality (for the torch) and the scan itself.
		let diagnostics: GradingSheetDiagnostics | null = null;
		try {
			diagnostics = await diagnoseGradingSheetImageData(captureFrame(videoElement), {
				includeNormalizedImage: false,
			});
			if (session === cameraSession) await adjustTorch(diagnostics.quality);
		} catch (error) {
			console.warn('Failed to analyse camera frame:', error);
		}

		// The user may have cancelled or switched modes while the frame was analysed.
		if (session !== cameraSession || cameraState !== 'searching') return;

		const scan = diagnostics && scanFromDiagnostics(diagnostics);
		if (!scan) {
			// No readable sheet in this frame yet — keep looking.
			candidateKey = undefined;
			candidateFrames = 0;
			scheduleSearch(SCAN_INTERVAL_MS);
			return;
		}
		if (!isStableScan(scan)) {
			// Confirm the reading on the next frame right away, while the sheet is still in view.
			scheduleSearch(candidateFrames > 0 ? VIDEO_POLL_MS : SCAN_INTERVAL_MS);
			return;
		}

		cameraState = 'processing';
		stopCamera();
		statusLabel = i18n.t('scanner.processing');
		try {
			const scored = await scoreScan(scan);
			if (cameraState !== 'processing') return;
			result = scored;
			cameraState = 'result';
		} catch (error) {
			// The sheet was read but cannot be graded (e.g. unknown revision): retrying frames won't help.
			if (cameraState !== 'processing') return;
			errorMessage = error instanceof Error ? error.message : String(error);
			cameraState = 'error';
		}
	}

	function retry() {
		resetResults();
		if (mode === 'camera') cameraState = 'idle';
		else imageState = 'idle';
	}

	function boxLabel(labels: string[], index: number): string {
		if (index < 0) return '—';
		return labels[index] ?? '?';
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

			{#if result.detectedRows !== result.totalQuestions}
				<p class="warning-text" role="alert">
					{i18n.t('scanner.rowMismatch', {
						detected: result.detectedRows,
						expected: result.totalQuestions,
					})}
				</p>
			{/if}

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
					{#each result.responses as response (response.label)}
						<tr class:correct={response.isCorrect} class:incorrect={!response.isCorrect}>
							<td>{response.label}</td>
							<td class:empty={response.scannedIndex < 0}>
								{boxLabel(response.answerLabels, response.scannedIndex)}
							</td>
							<td>{boxLabel(response.answerLabels, response.correctIndex)}</td>
							<td>
								{#if response.isCorrect}
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
	.warning-text {
		border: 1px solid var(--warning);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin: 0 0 var(--space-4);
		font-size: 0.875rem;
	}

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
