<script lang="ts">
	import FixedCanvas from '@/lib/ui/FixedCanvas.svelte';
	import { arucoMarkerSvg } from '@/utils/aruco';
	import {
		ARUCO_MARKER_SIZE,
		GRID_AREA,
		OMR_BLOCK_WIDTH_MM,
		OMR_DESIGN_HEIGHT,
		OMR_DESIGN_WIDTH,
		QR_CODE_SIZE,
		arucoMarkerPlacements,
		metadataQrPlacement,
		omrExclusionZones,
		sheetMetadataQrPayload,
	} from '@/utils/omr';
	import { LINE_HEIGHT_MM } from '@/utils/paper';
	import { qrCodeSvg } from '@/utils/qrcode';

	interface Props {
		testName?: string;
		revisionName?: string;
		revisionId: string;
	}

	let { testName = '', revisionName = '', revisionId }: Props = $props();

	/** Instruction block always reserves exactly this many lines of height. */
	const INSTRUCTION_LINES = 6;

	// The metadata QR payload is deterministic per revision, so the SVG is
	// computed synchronously — no async gap where a print could happen without it.
	let metadataPayload = $derived(sheetMetadataQrPayload(revisionId));
	let metadataQr = $derived(qrCodeSvg(metadataPayload));
	const qrPlacement = metadataQrPlacement();
	let markerSvgs = $derived(
		arucoMarkerPlacements().map((marker) => ({
			...marker,
			svg: arucoMarkerSvg(marker.id),
		}))
	);
	const exclusionZones = omrExclusionZones();
</script>

<div class="answer-sheet">
	<header class="sheet-header">
		<div class="sheet-header-test">{testName}</div>
		<div class="sheet-header-revision">{revisionName}</div>
	</header>

	<section
		class="instructions"
		style:height="{INSTRUCTION_LINES * LINE_HEIGHT_MM}mm"
		aria-label="Instrukcja wypełniania karty odpowiedzi"
	>
		<p class="instructions-title">Jak wypełnić kartę odpowiedzi?</p>
		<ul>
			<li>Wypełniaj kółka całkowicie, używając ciemnego długopisu lub ołówka.</li>
			<li>Przy każdym pytaniu zaznacz dokładnie jedną odpowiedź.</li>
			<li>Aby zmienić odpowiedź, przekreśl błędnie wypełnione kółko i zaznacz nowe.</li>
			<li>Nie zapisuj rogów karty ani kodów — są potrzebne do automatycznego skanowania.</li>
		</ul>
	</section>

	<FixedCanvas
		class="omr-block"
		designWidth={OMR_DESIGN_WIDTH}
		designHeight={OMR_DESIGN_HEIGHT}
		widthMm={OMR_BLOCK_WIDTH_MM}
	>
		<div
			class="omr-grid-plane"
			style:left="{GRID_AREA.x}px"
			style:top="{GRID_AREA.y}px"
			style:width="{GRID_AREA.width}px"
			style:height="{GRID_AREA.height}px"
		>
			<span>Obszar siatki odpowiedzi (z wyłączeniami)</span>
		</div>

		{#each exclusionZones as zone (zone.key)}
			<div
				class="omr-exclusion-zone"
				style:left="{zone.x}px"
				style:top="{zone.y}px"
				style:width="{zone.width}px"
				style:height="{zone.height}px"
				aria-hidden="true"
			>
				<span>{zone.label}</span>
			</div>
		{/each}

		{#each markerSvgs as marker (marker.id)}
			<div
				class="omr-marker"
				style:left="{marker.x}px"
				style:top="{marker.y}px"
				style:width="{ARUCO_MARKER_SIZE}px"
				style:height="{ARUCO_MARKER_SIZE}px"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html marker.svg}
			</div>
		{/each}

		<div
			class="omr-qr"
			style:left="{qrPlacement.x}px"
			style:top="{qrPlacement.y}px"
			style:width="{QR_CODE_SIZE}px"
			style:height="{QR_CODE_SIZE}px"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html metadataQr}
		</div>
	</FixedCanvas>
</div>

<style>
	.answer-sheet {
		font-family: Georgia, 'Times New Roman', Times, serif;
		font-size: var(--print-font, 12pt);
		line-height: 1.4;
		color: #000000;
		display: flex;
		flex-direction: column;
		gap: 4mm;
		height: 100%;
	}

	/* Mirrors the question sheet header so both pages can be compared visually. */
	.sheet-header {
		display: flex;
		flex-direction: column;
		gap: 1mm;
		padding-bottom: 2mm;
		border-bottom: 0.5pt solid #000000;
	}

	.sheet-header-test {
		font-size: 16pt;
		font-weight: 700;
	}

	.sheet-header-revision {
		font-weight: 700;
	}

	.instructions {
		overflow: hidden;
	}

	.instructions-title {
		font-weight: 700;
		margin: 0;
	}

	.instructions ul {
		margin: 0;
		padding-left: 6mm;
	}

	.omr-marker,
	.omr-qr,
	.omr-grid-plane,
	.omr-exclusion-zone {
		position: absolute;
	}

	/* The generated SVGs carry no width/height attributes — stretch them to
	   their positioned containers. */
	.omr-marker :global(svg),
	.omr-qr :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.omr-grid-plane {
		border: 4px dashed #999999;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #999999;
		font-size: 40px;
	}

	.omr-exclusion-zone {
		border: 2px solid #777777;
		background: rgba(0, 0, 0, 0.06);
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		color: #777777;
		font-size: 18px;
		padding-top: 6px;
	}
</style>
