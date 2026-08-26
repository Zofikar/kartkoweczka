<script lang="ts">
	import {
		analyzeGradingSheetImage,
		type DetectedArucoMarker,
		type DetectedQrCode,
		drawImageDataToCanvas,
		type GradingSheetDebugResult,
		type NormalizedOverlayRect,
		OMR_DESIGN_HEIGHT,
		OMR_DESIGN_WIDTH,
	} from '@/utils/omrDebugScanner';

	let result = $state<GradingSheetDebugResult | null>(null);
	let isAnalyzing = $state(false);
	let errorMessage = $state('');
	let normalizedCanvas = $state<HTMLCanvasElement>();
	let sourceObjectUrl = $state('');

	let sourceSizeLabel = $derived(result ? `${result.image.width} × ${result.image.height}px` : '—');
	let markedAreaQrMetadataJson = $derived(formatMetadata(result?.qrCodeInMarkedArea));

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
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			isAnalyzing = false;
		}
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
		return qrCode ? JSON.stringify(qrCode.metadata, null, 2) : 'Nie wykryto metadanych QR';
	}

	function markerPoints(marker: DetectedArucoMarker): string {
		return marker.corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
	}

	function overlayStyle(rect: NormalizedOverlayRect): string {
		return [
			`left: ${(rect.x / OMR_DESIGN_WIDTH) * 100}%`,
			`top: ${(rect.y / OMR_DESIGN_HEIGHT) * 100}%`,
			`width: ${(rect.width / OMR_DESIGN_WIDTH) * 100}%`,
			`height: ${(rect.height / OMR_DESIGN_HEIGHT) * 100}%`,
		].join('; ');
	}
</script>

<svelte:head>
	<title>Debug OMR karty odpowiedzi – Kartkóweczka</title>
	<meta
		name="description"
		content="Diagnostyczna stronka do analizy karty odpowiedzi z markerami ArUco i QR kodami w Kartkóweczce."
	/>
</svelte:head>

<section class="debug-page">
	<header class="page-header">
		<p class="eyebrow">DEBUG</p>
		<h1>Diagnostyka karty odpowiedzi</h1>
		<p>
			Wgraj zdjęcie lub skan karty odpowiedzi, aby wykryć orientację z markerów ArUco, znormalizować
			obszar OMR i odczytać QR z obszaru oznaczonego markerami.
		</p>
	</header>

	<label class="upload-card">
		<span>Obraz karty odpowiedzi</span>
		<input type="file" accept="image/*" onchange={handleFileChange} disabled={isAnalyzing} />
		<small>{isAnalyzing ? 'Analizuję obraz…' : 'PNG, JPG, WebP lub zdjęcie z telefonu'}</small>
	</label>

	{#if errorMessage}
		<p class="error-message">{errorMessage}</p>
	{/if}

	{#if result}
		<div class="summary-grid">
			<div class="summary-card"><strong>Obraz</strong><span>{sourceSizeLabel}</span></div>
			<div class="summary-card">
				<strong>ArUco</strong><span>{result.arucoMarkers.length} marker(y)</span>
			</div>
			<div class="summary-card">
				<strong>QR</strong><span
					>{result.qrCodeInMarkedArea ? 'wykryty w obszarze ArUco' : 'brak w obszarze ArUco'}</span
				>
			</div>
			<div class="summary-card">
				<strong>Normalizacja</strong><span>{result.normalizedImage ? 'OK' : 'niedostępna'}</span>
			</div>
		</div>

		{#if result.warnings.length}
			<ul class="warnings">
				{#each result.warnings as warning (warning)}<li>{warning}</li>{/each}
			</ul>
		{/if}

		<div class="debug-grid">
			<section class="panel">
				<h2>Źródło z wykryciami</h2>
				<div class="image-stage">
					<img src={sourceObjectUrl} alt="Wgrana karta odpowiedzi" />
					<svg viewBox="0 0 {result.image.width} {result.image.height}" aria-hidden="true">
						{#each result.arucoMarkers as marker (`${marker.id}-${marker.center.x}-${marker.center.y}`)}
							<polygon class="aruco-polygon" points={markerPoints(marker)} />
							<text x={marker.center.x} y={marker.center.y}
								>{marker.corner ?? '?'} #{marker.id}</text
							>
						{/each}
					</svg>
				</div>
			</section>

			<section class="panel">
				<h2>Znormalizowana geometria</h2>
				<div class="normalized-stage" style:aspect-ratio="{OMR_DESIGN_WIDTH} / {OMR_DESIGN_HEIGHT}">
					{#if result.normalizedImage}
						<canvas bind:this={normalizedCanvas} aria-label="Znormalizowany obraz karty odpowiedzi"
						></canvas>
					{:else}
						<div class="empty-normalized">Potrzebne są cztery wykryte markery narożne.</div>
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
				<h2>QR metadanych w obszarze ArUco</h2>
				<pre>{markedAreaQrMetadataJson}</pre>
			</section>
			<section class="panel">
				<h2>Markery ArUco</h2>
				<table>
					<thead><tr><th>ID</th><th>Narożnik</th><th>Środek</th></tr></thead>
					<tbody>
						{#each result.arucoMarkers as marker (`table-${marker.id}-${marker.center.x}-${marker.center.y}`)}
							<tr
								><td>{marker.id}</td><td>{marker.corner ?? 'nieznany'}</td><td
									>{marker.center.x.toFixed(1)}, {marker.center.y.toFixed(1)}</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</section>
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
</style>
