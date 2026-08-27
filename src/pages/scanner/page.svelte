<script lang="ts">
	import {
		scanGradingSheetImage,
		detectMarkersInFrame,
		detectQrCode,
		normalizeImageIfPossible,
		resolveOmrConfig,
		computeScore,
		type DetectedQrCode,
		type OmrScanResult,
	} from '@/utils/omrScanner';
	import type { OmrConfig } from '@/utils/omr';
	import { getTest, getTestRevision } from '@/db/repositories';
	import Button from '$lib/ui/Button.svelte';

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
		resetResults();
		imageState = 'analyzing';
		statusLabel = 'Analizuję obraz…';

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

		statusLabel = 'Wczytuję wersję testu…';
		const revision = await getTestRevision(revisionId);
		if (!revision)
			throw new Error('Nieznana rewizja testu. Kod QR wskazuje na rewizję, której nie ma w bazie.');

		const test = await getTest(revision.testId);
		const testName = test?.name ?? 'Nieznany test';

		statusLabel = 'Skanuję odpowiedzi…';
		const counts = revision.content.map((q) => q.answers.length);
		const gridBounds = scan.omrConfig.grid.calculateGridBounds(scan.omrConfig);
		const columns = scan.omrConfig.grid.calculateGridColumns(scan.omrConfig, gridBounds, counts);
		const scannedAnswers = scan.omrConfig.grid.scanGrid(
			scan.omrConfig,
			scan.normalizedImage,
			columns
		);

		const score = computeScore(scannedAnswers, revision.content);
		return {
			scanStatus: 'success',
			revisionId,
			testId: revision.testId,
			testName,
			revisionName: revision.name,
			scannedAnswers,
			correctAnswers: score.correctAnswers,
			correctAnswerIndices: score.correctAnswerIndices,
			score: score.score,
			totalQuestions: score.totalQuestions,
			normalizedImage: scan.normalizedImage,
		};
	}

	// ─── Camera mode ──────────────────────────────────────────────────────────

	async function startCamera() {
		resetResults();
		cameraState = 'searching';
		statusLabel = 'Szukam karty odpowiedzi…';

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment',
					width: { min: 1280, ideal: 1920 },
					height: { min: 720, ideal: 1080 },
				},
			});
		} catch {
			errorMessage = 'Kamera jest niedostępna. Sprawdź uprawnienia lub użyj trybu zdjęcia.';
			cameraState = 'error';
			return;
		}
		if (!videoElement) {
			stopCamera();
			return;
		}
		videoElement.srcObject = stream;
		await videoElement.play();
		requestAnimationFrame(searchFrame);
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
			const markers = await detectMarkersInFrame(imageData);

			if (markers.length < 4) {
				scheduleNextFrame();
				return;
			}

			const omrConfig = resolveOmrConfig(markers);
			const normalized = normalizeImageIfPossible(omrConfig, imageData, markers);
			if (!normalized) {
				scheduleNextFrame();
				return;
			}

			const qrCode = await detectQrCode(omrConfig, normalized);
			if (!qrCode?.metadata?.revisionId) {
				scheduleNextFrame();
				return;
			}

			cameraState = 'processing';
			stopCamera();
			statusLabel = 'Przetwarzanie…';
			result = await processFrozenFrame(omrConfig, normalized, qrCode);
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
		omrConfig: OmrConfig,
		normalized: ImageData,
		qrCode: DetectedQrCode
	): Promise<OmrScanResult> {
		const revisionId = qrCode.metadata!.revisionId;
		const revision = await getTestRevision(revisionId);
		if (!revision) throw new Error('Nieznana rewizja testu.');

		const test = await getTest(revision.testId);
		const testName = test?.name ?? 'Nieznany test';

		const counts = revision.content.map((q) => q.answers.length);
		const gridBounds = omrConfig.grid.calculateGridBounds(omrConfig);
		const columns = omrConfig.grid.calculateGridColumns(omrConfig, gridBounds, counts);
		const scannedAnswers = omrConfig.grid.scanGrid(omrConfig, normalized, columns);
		const score = computeScore(scannedAnswers, revision.content);

		return {
			scanStatus: 'success',
			revisionId,
			testId: revision.testId,
			testName,
			revisionName: revision.name,
			scannedAnswers,
			correctAnswers: score.correctAnswers,
			correctAnswerIndices: score.correctAnswerIndices,
			score: score.score,
			totalQuestions: score.totalQuestions,
			normalizedImage: normalized,
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
	<h1 class="page-title">Skaner kart odpowiedzi</h1>

	<!-- Mode tabs -->
	<div class="mode-tabs">
		<button class="mode-tab" class:active={mode === 'image'} onclick={() => switchMode('image')}>
			🖼️ Zdjęcie
		</button>
		<button class="mode-tab" class:active={mode === 'camera'} onclick={() => switchMode('camera')}>
			📷 Kamera
		</button>
	</div>

	<!-- Image mode -->
	{#if mode === 'image'}
		<div class="section">
			{#if imageState === 'idle' || imageState === 'error'}
				<label class="upload-label">
					Wybierz zdjęcie karty odpowiedzi
					<input type="file" accept="image/*" class="file-input" onchange={handleImageFile} />
				</label>
			{/if}

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
			{#if cameraState === 'idle'}
				<button class="camera-start-btn" onclick={startCamera}>Rozpocznij skanowanie</button>
			{/if}

			{#if cameraState === 'searching'}
				<div class="video-wrapper">
					<video bind:this={videoElement} autoplay playsinline muted class="video-preview"></video>
					<div class="video-overlay">
						<div class="spinner"></div>
						<p>{statusLabel}</p>
					</div>
				</div>
				<button class="cancel-btn" onclick={cancelCamera}>Anuluj</button>
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
			<button class="retry-btn" onclick={retry}>Spróbuj ponownie</button>
		</div>
	{/if}

	<!-- Result display -->
	{#if result && (imageState === 'result' || cameraState === 'result')}
		<div class="result-card">
			<div class="result-meta">
				<p>
					Test:
					<a href="/tests/{result.testId}" class="meta-link">{result.testName}</a>
				</p>
				<p>
					Wersja:
					<a href="/tests/{result.testId}/revision/{result.revisionId}" class="meta-link"
						>{result.revisionName}</a
					>
				</p>
			</div>
			<div class="score-row">
				<h2>Wynik: {result.score}/{result.totalQuestions}</h2>
				<p class="percentage">
					{Math.round((result.score / Math.max(1, result.totalQuestions)) * 100)}%
				</p>
				<Button size="sm" variant="outline" onclick={retry}>Skanuj ponownie</Button>
			</div>

			<table class="answers-table">
				<thead>
					<tr>
						<th>#</th>
						<th>Odpowiedź</th>
						<th>Poprawna odpowiedź</th>
						<th>Poprawna</th>
					</tr>
				</thead>
				<tbody>
					{#each result.scannedAnswers as scanned, i (i)}
						{@const isCorrect = result.correctAnswers[i]}
						{@const correctIdx = result.correctAnswerIndices[i]}
						<tr class:correct={isCorrect} class:incorrect={!isCorrect}>
							<td>{i + 1}</td>
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

	/* Mode tabs */
	.mode-tabs {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	.mode-tab {
		flex: 1;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		font-size: 1rem;
		cursor: pointer;
		text-align: center;
	}

	.mode-tab.active {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
	}

	/* Section */
	.section {
		margin-bottom: var(--space-4);
	}

	/* Upload */
	.upload-label {
		display: block;
		padding: var(--space-6);
		border: 2px dashed var(--border);
		border-radius: var(--radius-lg);
		text-align: center;
		cursor: pointer;
		color: var(--text-secondary, #6b7280);
		font-size: 1rem;
	}

	.upload-label:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.file-input {
		display: none;
	}

	/* Camera */
	.camera-start-btn {
		width: 100%;
		padding: var(--space-4);
		border: none;
		border-radius: var(--radius-md);
		background: var(--primary);
		color: #fff;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.video-wrapper {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: #000;
	}

	.video-preview {
		display: block;
		width: 100%;
		aspect-ratio: 4/3;
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

	.cancel-btn {
		margin-top: var(--space-3);
		width: 100%;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
		font-size: 0.875rem;
		cursor: pointer;
	}

	.cancel-btn:hover {
		background: var(--primary-muted);
	}
	.status-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-6);
		color: var(--text-secondary, #6b7280);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--primary);
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
		color: var(--danger, #ef4444);
		margin: 0 0 var(--space-3);
	}

	.retry-btn {
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.retry-btn:hover {
		background: var(--primary-light, #dbeafe);
	}

	/* Result */
	.result-meta {
		margin-bottom: var(--space-4);
	}

	.result-meta p {
		margin: 0 0 var(--space-1);
		font-size: 0.875rem;
		color: var(--text-secondary, #6b7280);
	}

	.meta-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 600;
	}

	.meta-link:hover {
		text-decoration: underline;
	}

	.result-card {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
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
		border-bottom: 1px solid var(--border);
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
		color: #9ca3af;
	}

	.check,
	.cross {
		font-size: 1.125rem;
	}
</style>
