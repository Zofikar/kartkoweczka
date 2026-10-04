<script lang="ts">
	import {
		analyzeGradingSheetImage,
		type DetectedArucoMarker,
		type DetectedQrCode,
		drawImageDataToCanvas,
		type GradingSheetDebugResult,
		type NormalizedOverlayRect,
	} from '@/utils/omrDebugScanner';
	import { SHEET_SIZE } from '@/utils/omrScanner';
	import { getTestRevision } from '@/db/repositories';
	import { i18n } from '@/lib/i18n.svelte';
	import { buildQuestionResponseRows } from '@/utils/questionResponses';

	let result = $state<GradingSheetDebugResult | null>(null);
	let isAnalyzing = $state(false);
	let errorMessage = $state('');
	let normalizedCanvas = $state<HTMLCanvasElement>();
	let sourceObjectUrl = $state('');
	/** Manual answer-counts input, auto-filled when QR metadata resolves the revision. */
	let answerCountsInput = $state('');
	/** Whether answer counts were resolved from the database (not manually typed). */
	let answerCountsFromDb = $state(false);

	let sourceSizeLabel = $derived(result ? `${result.image.width} × ${result.image.height}px` : '—');
	let markedAreaQrMetadataJson = $derived(formatMetadata(result?.qrCodeInMarkedArea));
	let diagnosticStagesLabel = $derived(result?.stages.join(' → ') ?? '—');

	/** Comma-separated answer counts → number array (e.g. "4,4,5,4"). */
	let answersPerQuestion = $derived(parseAnswerCounts(answerCountsInput));

	function parseAnswerCounts(raw: string): number[] {
		return raw
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => Number.isFinite(n) && n >= 1 && n <= 26);
	}

	function formatAnswerCounts(counts: number[]): string {
		return counts.join(', ');
	}

	$effect(() => {
		if (result?.normalizedImage && normalizedCanvas)
			drawImageDataToCanvas(normalizedCanvas, result.normalizedImage);
	});

	async function handleFileChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		await analyzeFile(file);
	}

	async function analyzeFile(file: File) {
		try {
			startAnalysis(file);
			result = await analyzeGradingSheetImage(file);
			await resolveAnswerCountsFromQr();
			await runGridScan();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			isAnalyzing = false;
		}
	}

	/**
	 * If the decoded QR carries a revision ID, load that revision from the
	 * database and auto-fill the answer-counts input.
	 */
	async function resolveAnswerCountsFromQr() {
		if (!result) return;
		const revisionId = result.qrCodeInMarkedArea?.metadata?.revisionId;
		if (!revisionId) return;

		try {
			const revision = await getTestRevision(revisionId);
			if (revision) {
				const counts = buildQuestionResponseRows(revision.content).map(
					(row) => row.answerLabels.length
				);
				answerCountsInput = formatAnswerCounts(counts);
				answerCountsFromDb = true;
			}
		} catch (err) {
			console.warn('Nie udało się wczytać rewizji po QR:', err);
		}
	}

	async function runGridScan() {
		if (result) result = { ...result };
	}

	function startAnalysis(file: File) {
		isAnalyzing = true;
		errorMessage = '';
		result = null;
		replaceSourceObjectUrl(file);
	}

	function replaceSourceObjectUrl(file: File) {
		if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
		sourceObjectUrl = URL.createObjectURL(file);
	}

	function formatMetadata(qrCode: DetectedQrCode | null | undefined): string {
		if (!qrCode) return i18n.t('debug.noMetadata');
		return qrCode.metadata
			? JSON.stringify(qrCode.metadata, null, 2)
			: i18n.t('debug.unknownQr', { data: qrCode.data });
	}

	function markerPoints(marker: DetectedArucoMarker): string {
		return marker.corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
	}

	function overlayStyle(rect: NormalizedOverlayRect): string {
		return [
			`left: ${(rect.x / SHEET_SIZE.width) * 100}%`,
			`top: ${(rect.y / SHEET_SIZE.height) * 100}%`,
			`width: ${(rect.width / SHEET_SIZE.width) * 100}%`,
			`height: ${(rect.height / SHEET_SIZE.height) * 100}%`,
		].join('; ');
	}

	function qualityLabel(quality: GradingSheetDebugResult['quality']): string {
		if (quality === 'too-dark') return i18n.t('debug.qualityDark');
		if (quality === 'too-bright') return i18n.t('debug.qualityBright');
		return i18n.t('debug.qualityGood');
	}
</script>

<svelte:head>
	<title>{i18n.t('debug.title')}</title>
	<meta name="description" content={i18n.t('debug.description')} />
</svelte:head>

<section class="debug-page">
	<header class="page-header">
		<p class="eyebrow">DEBUG</p>
		<h1>{i18n.t('debug.heading')}</h1>
		<p>{i18n.t('debug.intro')}</p>
	</header>

	<label class="upload-card">
		<span>{i18n.t('debug.image')}</span>
		<input type="file" accept="image/*" onchange={handleFileChange} disabled={isAnalyzing} />
		<small>{isAnalyzing ? i18n.t('debug.analyzing') : i18n.t('debug.imageHint')}</small>
	</label>

	<label class="upload-card">
		<span>{i18n.t('debug.answerCounts')}</span>
		<div class="counts-row">
			<input
				type="text"
				bind:value={answerCountsInput}
				placeholder={i18n.t('debug.countsPlaceholder')}
				disabled={isAnalyzing}
			/>
			{#if result?.normalizedImage && answersPerQuestion.length > 0}
				<button
					type="button"
					class="scan-button"
					disabled={isAnalyzing}
					onclick={() => runGridScan()}
				>
					{i18n.t('debug.scanGrid')}
				</button>
			{/if}
		</div>
		<small>
			{#if answerCountsFromDb}
				<span class="db-badge">{i18n.t('debug.fromDatabase')}</span>
			{/if}
			{i18n.t('debug.countsHint')}
		</small>
	</label>

	{#if errorMessage}
		<p class="error-message">{errorMessage}</p>
	{/if}

	{#if result}
		<div class="summary-grid">
			<div class="summary-card">
				<strong>{i18n.t('debug.imageSummary')}</strong><span>{sourceSizeLabel}</span>
			</div>
			<div class="summary-card">
				<strong>ArUco</strong><span>{result.arucoMarkers.length} marker(y)</span>
			</div>
			<div class="summary-card">
				<strong>QR</strong><span
					>{result.qrCodeInMarkedArea ? 'wykryty w obszarze ArUco' : 'brak w obszarze ArUco'}</span
				>
			</div>
			<div class="summary-card">
				<strong>{i18n.t('debug.normalization')}</strong><span
					>{result.normalizedImage ? 'OK' : i18n.t('debug.unavailable')}</span
				>
			</div>
			<div class="summary-card">
				<strong>{i18n.t('debug.imageQuality')}</strong><span>{qualityLabel(result.quality)}</span>
			</div>
		</div>

		<section class="panel diagnostics-panel">
			<h2>{i18n.t('debug.stages')}</h2>
			<code>{diagnosticStagesLabel}</code>
		</section>

		{#if result.warnings.length}
			<ul class="warnings">
				{#each result.warnings as warning (warning)}<li>{warning}</li>{/each}
			</ul>
		{/if}

		<div class="debug-grid">
			<section class="panel">
				<h2>{i18n.t('debug.source')}</h2>
				<div class="image-stage">
					<img src={sourceObjectUrl} alt={i18n.t('debug.sourceAlt')} />
					<svg viewBox="0 0 {result.image.width} {result.image.height}" aria-hidden="true">
						{#each result.arucoMarkers as marker (`${marker.id}-${marker.center.x}-${marker.center.y}`)}
							<polygon class="aruco-polygon" points={markerPoints(marker)} />
							<text x={marker.center.x} y={marker.center.y}>#{marker.id}</text>
						{/each}
					</svg>
				</div>
			</section>

			<section class="panel">
				<h2>{i18n.t('debug.normalized')}</h2>
				<div class="normalized-stage" style:aspect-ratio="{SHEET_SIZE.width} / {SHEET_SIZE.height}">
					{#if result.normalizedImage}
						<canvas bind:this={normalizedCanvas} aria-label={i18n.t('debug.normalizedAria')}
						></canvas>
					{:else}
						<div class="empty-normalized">
							{i18n.t('debug.normalizationFailed')}
						</div>
					{/if}
					<div class="normalized-overlay" aria-hidden="true">
						{#each result.overlayRects as rect (rect.key)}
							<div class="overlay-rect overlay-rect--{rect.kind}" style={overlayStyle(rect)}></div>
						{/each}
					</div>
				</div>
			</section>
		</div>

		<div class="metadata-grid">
			<section class="panel">
				<h2>{i18n.t('debug.metadata')}</h2>
				<pre>{markedAreaQrMetadataJson}</pre>
			</section>
			<section class="panel">
				<h2>{i18n.t('debug.markers')}</h2>
				<table>
					<thead
						><tr><th>ID</th><th>{i18n.t('debug.corner')}</th><th>{i18n.t('debug.center')}</th></tr
						></thead
					>
					<tbody>
						{#each result.arucoMarkers as marker (`table-${marker.id}-${marker.center.x}-${marker.center.y}`)}
							<tr
								><td>{marker.id}</td><td>{i18n.t('debug.detected')}</td><td
									>{marker.center.x.toFixed(1)}, {marker.center.y.toFixed(1)}</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</section>

			{#if result.scannedAnswers}
				<section class="panel">
					<h2>{i18n.t('debug.answers')}</h2>
					<table class="answers-table">
						<thead>
							<tr>
								<th>{i18n.t('debug.question')}</th>
								<th>{i18n.t('debug.selectedAnswer')}</th>
							</tr>
						</thead>
						<tbody>
							{#each result.scannedAnswers as answer, i (i)}
								<tr>
									<td>{i + 1}</td>
									<td class:answer-valid={answer >= 0} class:answer-empty={answer < 0}>
										{answer >= 0 ? String.fromCharCode(65 + answer) : '—'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{:else if result.normalizedImage}
				<section class="panel">
					<h2>{i18n.t('debug.answers')}</h2>
					<p class="scan-hint">
						{i18n.t('debug.scanHint')}
					</p>
				</section>
			{/if}
		</div>
	{/if}
</section>

<style>
	.debug-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding: var(--space-6);
	}
	.page-header {
		max-width: 880px;
	}
	.eyebrow {
		color: var(--warning, #f59e0b);
		font-weight: 700;
		letter-spacing: 0.08em;
		margin: 0 0 var(--space-2);
	}
	.upload-card,
	.panel,
	.summary-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}
	.upload-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		max-width: 520px;
		cursor: pointer;
	}
	.upload-card span {
		font-weight: 700;
	}
	.summary-grid,
	.debug-grid,
	.metadata-grid {
		display: grid;
		gap: var(--space-4);
	}
	.summary-grid {
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}
	.debug-grid,
	.metadata-grid {
		grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
	}
	.summary-card,
	.panel {
		padding: var(--space-4);
	}
	.summary-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.error-message,
	.warnings {
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
	}
	.error-message {
		background: rgba(239, 68, 68, 0.12);
		color: var(--danger, #ef4444);
	}
	.warnings {
		background: rgba(245, 158, 11, 0.12);
		color: var(--warning, #f59e0b);
		margin: 0;
	}
	.image-stage,
	.normalized-stage {
		position: relative;
		overflow: hidden;
		background: #ffffff;
		border-radius: var(--radius-md);
	}
	.image-stage img,
	.image-stage svg,
	.normalized-stage canvas,
	.normalized-overlay {
		display: block;
		width: 100%;
	}
	.image-stage svg,
	.normalized-overlay {
		position: absolute;
		inset: 0;
		height: 100%;
	}
	.aruco-polygon,
	.qr-polygon {
		fill: transparent;
		stroke-width: 5;
		vector-effect: non-scaling-stroke;
	}
	.aruco-polygon {
		stroke: #22c55e;
	}
	.qr-polygon {
		stroke: #3b82f6;
	}
	text {
		fill: #22c55e;
		font: 24px sans-serif;
		paint-order: stroke;
		stroke: #000000;
		stroke-width: 3px;
	}
	.normalized-stage canvas {
		height: auto;
	}
	.empty-normalized {
		display: grid;
		min-height: 320px;
		place-items: center;
		color: #111827;
	}
	.overlay-rect {
		position: absolute;
		border: 2px solid;
		box-sizing: border-box;
		font-size: 10px;
		font-weight: 700;
		padding: 2px;
	}
	.overlay-rect--grid {
		border-color: rgba(148, 163, 184, 0.8);
	}
	.overlay-rect--marker {
		border-color: rgba(34, 197, 94, 0.95);
		color: #166534;
	}
	.overlay-rect--qr {
		border-color: rgba(59, 130, 246, 0.95);
		color: #1d4ed8;
	}
	.overlay-rect--exclusion {
		background: rgba(245, 158, 11, 0.14);
		border-color: rgba(245, 158, 11, 0.75);
		color: #92400e;
	}
	pre {
		overflow: auto;
		white-space: pre-wrap;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		border-bottom: 1px solid var(--border);
		padding: var(--space-2);
		text-align: left;
	}

	.answers-table {
		max-width: 320px;
	}

	.answer-valid {
		font-weight: 700;
		color: #166534;
	}

	.answer-empty {
		color: #9ca3af;
	}

	.db-badge {
		display: inline-block;
		background: #dbeafe;
		color: #1e40af;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0 4px;
		border-radius: 3px;
		margin-right: 4px;
		vertical-align: middle;
	}

	.counts-row {
		display: flex;
		gap: var(--space-2);
	}

	.scan-button {
		flex-shrink: 0;
		align-self: flex-start;
		padding: 0 var(--space-3);
		height: 36px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		font-size: 0.875rem;
		cursor: pointer;
	}

	.scan-button:hover {
		background: var(--primary-light, #dbeafe);
		border-color: var(--primary, #2563eb);
	}

	.scan-hint {
		color: #6b7280;
		margin: 0;
	}
</style>
