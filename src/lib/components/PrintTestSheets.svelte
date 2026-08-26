<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import Button from '@/lib/ui/Button.svelte';
	import PrintAnswerSheet from '@/lib/components/PrintAnswerSheet.svelte';
	import type { SnapshotQuestion } from '@/db/repositories';
	import { renderDocumentToHtml } from '@/utils/math';
	import {
		A4_WIDTH_MM,
		BASE_GAP_MM,
		BODY_INDENT_MM,
		QUESTION_GAP_MM,
		PRINT_FONT_SIZE_PT,
		USABLE_HEIGHT_MM,
		USABLE_WIDTH_MM,
		computeImageDisplaySize,
		type ImageDisplaySize,
		type ImagePlacementValue,
	} from '@/utils/paper';

	const PX_PER_MM = 96 / 25.4;

	/** Images smaller than this fraction of usable width stay beside answers. */
	const SMALL_IMAGE_WIDTH_FRACTION = 1 / 3;

	interface Props {
		questions: SnapshotQuestion[];
		testName?: string;
		revisionName?: string;
		/** When set, a machine-readable answer sheet page can be appended. */
		revisionId?: string;
		open?: boolean;
		onclose?: () => void;
	}

	let {
		questions,
		testName = '',
		revisionName = '',
		revisionId,
		open = false,
		onclose,
	}: Props = $props();

	let includeAnswerSheet = $state(true);

	interface PreparedAnswer {
		key: string;
		letter: string;
		html: string;
	}

	interface PreparedQuestion {
		key: string;
		number: number;
		contentHtml: string;
		image: string | null;
		imageReady: boolean;
		placement: ImagePlacementValue;
		answers: PreparedAnswer[];
		imageSize: ImageDisplaySize | null;
		imageStyle: string;
		smallImageBeside: boolean;
	}

	/** Natural (intrinsic) pixel dimensions of each image, keyed by data URL. */
	let imageDims = $state<Record<string, { width: number; height: number }>>({});

	// Load natural dimensions for every unique image in the sheet.
	$effect(() => {
		const seen = new SvelteSet<string>();
		for (const q of questions) {
			if (q.image) seen.add(q.image);
		}
		for (const src of seen) {
			if (imageDims[src]) continue;
			const img = new Image();
			img.onload = () => {
				if (imageDims[src]) return;
				imageDims = {
					...imageDims,
					[src]: { width: img.naturalWidth, height: img.naturalHeight },
				};
			};
			img.onerror = () => {
				imageDims = { ...imageDims, [src]: { width: 0, height: 0 } };
			};
			img.src = src;
		}
	});

	let prepared = $derived.by((): PreparedQuestion[] => {
		return questions.map((q, index) => {
			const placement = (q.imagePlacement ?? 'over') as ImagePlacementValue;
			const answers: PreparedAnswer[] = q.answers.map((a, i) => ({
				key: `a-${index}-${i}`,
				letter: String.fromCharCode(65 + i),
				html: renderDocumentToHtml(a.content),
			}));

			const dims = q.image ? imageDims[q.image] : undefined;
			const hasDims = dims !== undefined && dims.width > 0 && dims.height > 0;
			const imageReady = !!q.image && hasDims;
			const imageSize = hasDims
				? computeImageDisplaySize(dims.width, dims.height, placement, answers.length, q.imageHeight)
				: null;

			let imageStyle = '';
			if (imageSize) {
				imageStyle = `width: ${imageSize.widthMm}mm; height: ${imageSize.heightMm}mm;`;
			}

			// An 'over' image that renders small enough is kept horizontally
			// beside its answers instead of wasting vertical space above them.
			const smallImageBeside =
				placement === 'over' &&
				imageSize !== null &&
				imageSize.widthMm <= USABLE_WIDTH_MM * SMALL_IMAGE_WIDTH_FRACTION + 0.5;

			return {
				key: `q-${index}`,
				number: index + 1,
				contentHtml: renderDocumentToHtml(q.content),
				image: q.image ?? null,
				imageReady,
				placement,
				answers,
				imageSize,
				imageStyle,
				smallImageBeside,
			};
		});
	});

	const rootStyle = `--qa-gap: ${BASE_GAP_MM}mm; --q-gap: ${QUESTION_GAP_MM}mm; --body-indent: ${BODY_INDENT_MM}mm; --print-font: ${PRINT_FONT_SIZE_PT}pt;`;

	// ---- Measured pagination so preview and print agree on page breaks. ----
	let measureEl: HTMLElement | undefined = $state();
	let pages = $state<number[][]>([]);

	$effect(() => {
		// Re-run whenever content, image dimensions, names, or the node change.
		void prepared;
		void measureEl;
		void testName;
		void revisionName;
		void pages;
		if (!measureEl) return;
		requestAnimationFrame(() => requestAnimationFrame(measure));
	});

	function measure() {
		const root = measureEl;
		if (!root) return;
		const headerNode = root.querySelector<HTMLElement>('[data-header]');
		const headerHeightMm = headerNode ? headerNode.offsetHeight / PX_PER_MM : 0;
		const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-q-key]'));
		if (nodes.length !== prepared.length) return;

		const usableMm = USABLE_HEIGHT_MM;
		const gapMm = QUESTION_GAP_MM;
		const firstPageUsable = usableMm - (headerHeightMm > 0 ? headerHeightMm + gapMm : 0);

		const nextPages: number[][] = [];
		let currentPage: number[] = [];
		let used = 0;
		let pageIndex = 0;

		nodes.forEach((node, index) => {
			const heightMm = node.offsetHeight / PX_PER_MM;
			const pageUsable = pageIndex === 0 ? firstPageUsable : usableMm;
			const needed = currentPage.length === 0 ? heightMm : heightMm + gapMm;

			if (currentPage.length === 0 || used + needed <= pageUsable + 0.5) {
				currentPage.push(index);
				used += needed;
			} else {
				nextPages.push(currentPage);
				currentPage = [index];
				used = heightMm;
				pageIndex++;
			}
		});

		if (currentPage.length > 0) nextPages.push(currentPage);
		pages = nextPages;
	}

	let shownPages = $derived.by((): number[][] =>
		pages.length > 0 ? pages : [prepared.map((_, i) => i)]
	);

	let viewportWidth = $state(0);
	let previewScale = $derived(
		viewportWidth > 0
			? Math.max(0.15, Math.min(1, (viewportWidth - 48) / (A4_WIDTH_MM * PX_PER_MM)))
			: 1
	);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) onclose?.();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose?.();
	}
</script>

<svelte:window bind:innerWidth={viewportWidth} onkeydown={handleKeydown} />

{#snippet sheetHeader()}
	<header class="print-header" data-header>
		<div class="print-header-test">{testName}</div>
		<div class="print-header-revision">{revisionName}</div>
	</header>
{/snippet}

{#snippet questionBlock(q: PreparedQuestion)}
	<article class="print-question" data-q-key={q.key}>
		<div class="print-question-text">
			<span class="print-question-number">{q.number}.</span>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<span class="print-question-content">{@html q.contentHtml}</span>
		</div>

		<div class="print-body">
			{#if q.image && q.imageReady}
				{#if q.placement === 'over' && !q.smallImageBeside}
					<img class="print-image" style={q.imageStyle} src={q.image} alt="Ilustracja do pytania" />
					<ul class="print-answers">
						{#each q.answers as a (a.key)}
							<li class="print-answer">
								<span class="print-answer-letter">{a.letter}.</span>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								<span class="print-answer-text">{@html a.html}</span>
							</li>
						{/each}
					</ul>
				{:else if q.placement === 'left'}
					<div class="print-side">
						<img
							class="print-image print-image--side"
							style={q.imageStyle}
							src={q.image}
							alt="Ilustracja do pytania"
						/>
						<ul class="print-answers print-answers--inline">
							{#each q.answers as a (a.key)}
								<li class="print-answer">
									<span class="print-answer-letter">{a.letter}.</span>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<span class="print-answer-text">{@html a.html}</span>
								</li>
							{/each}
						</ul>
					</div>
				{:else}
					<!-- right placement, or a small 'over' image kept beside answers.
					     Answers keep their natural width so the image stays left-aligned
					     right next to them instead of being pinned to the right edge. -->
					<div class="print-side">
						<ul class="print-answers">
							{#each q.answers as a (a.key)}
								<li class="print-answer">
									<span class="print-answer-letter">{a.letter}.</span>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<span class="print-answer-text">{@html a.html}</span>
								</li>
							{/each}
						</ul>
						<img
							class="print-image print-image--side"
							style={q.imageStyle}
							src={q.image}
							alt="Ilustracja do pytania"
						/>
					</div>
				{/if}
			{:else}
				<ul class="print-answers">
					{#each q.answers as a (a.key)}
						<li class="print-answer">
							<span class="print-answer-letter">{a.letter}.</span>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<span class="print-answer-text">{@html a.html}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</article>
{/snippet}

{#snippet pageSheets(variant: 'preview' | 'output')}
	{#each shownPages as page, pageIndex (pageIndex)}
		<div class="print-page print-page--{variant}">
			{#if pageIndex === 0}
				{@render sheetHeader()}
			{/if}
			{#each page as qIndex (qIndex)}
				{@render questionBlock(prepared[qIndex])}
			{/each}
		</div>
	{/each}
	{#if includeAnswerSheet && revisionId}
		<div class="print-page print-page--{variant}">
			<PrintAnswerSheet
				{testName}
				{revisionName}
				{revisionId}
				answersPerQuestion={prepared.map((q) => q.answers.length)}
			/>
		</div>
	{/if}
{/snippet}

<!-- Off-screen measuring pass at the exact printable width. -->
<div class="print-measure" bind:this={measureEl} style={rootStyle}>
	{@render sheetHeader()}
	{#each prepared as q (q.key)}
		{@render questionBlock(q)}
	{/each}
</div>

{#if open}
	<!-- Escape is handled at the window level (see svelte:window above). -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="print-overlay"
		role="dialog"
		aria-modal="true"
		aria-label="Podgląd wydruku"
		tabindex="-1"
		onclick={handleBackdrop}
	>
		<div class="print-toolbar">
			<div class="print-toolbar-title">
				<h2 class="print-title">{testName || 'Kartkówka'}</h2>
				<span class="print-subtitle">A4 &middot; podgląd wydruku</span>
			</div>
			<div class="print-toolbar-actions">
				{#if revisionId}
					<label class="print-toggle">
						<input type="checkbox" bind:checked={includeAnswerSheet} />
						<span>Karta odpowiedzi</span>
					</label>
				{/if}
				<Button variant="primary" size="md" onclick={() => window.print()}>
					Drukuj / Zapisz PDF
				</Button>
				<Button variant="ghost" size="md" onclick={onclose}>Zamknij</Button>
			</div>
		</div>

		<div class="print-preview-scroll">
			<div class="print-preview-zoom" style="zoom: {previewScale}; {rootStyle}">
				{@render pageSheets('preview')}
			</div>
		</div>

		<div class="print-output" style={rootStyle}>
			{@render pageSheets('output')}
		</div>
	</div>
{/if}

<style>
	.print-overlay {
		position: fixed;
		inset: 0;
		z-index: 1500;
		background: var(--background);
		display: flex;
		flex-direction: column;
	}

	.print-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--background-muted);
		flex-shrink: 0;
	}

	.print-toolbar-title {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.print-title {
		font-family: var(--font-sans);
		font-size: var(--font-lg);
		font-weight: var(--font-semibold);
		color: var(--text);
		margin: 0;
	}

	.print-subtitle {
		font-family: var(--font-sans);
		font-size: var(--font-xs);
		color: var(--text-muted);
	}

	.print-toolbar-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.print-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-right: var(--space-2);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--text);
	}

	.print-toggle input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.print-preview-scroll {
		flex: 1;
		overflow: auto;
		padding: var(--space-4);
		background: color-mix(in srgb, var(--background), var(--muted) 4%);
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.print-preview-zoom {
		transform-origin: top left;
	}

	.print-output {
		display: none;
	}

	.print-measure {
		position: absolute;
		left: -99999px;
		top: 0;
		width: 180mm;
		visibility: hidden;
		pointer-events: none;
	}

	.print-page,
	.print-measure {
		font-family: Georgia, 'Times New Roman', Times, serif;
		font-size: var(--print-font);
		line-height: 1.4;
	}

	.print-page {
		box-sizing: border-box;
		width: 210mm;
		height: 297mm;
		padding: 15mm;
		margin: 0;
		background: #ffffff;
		color: #000000;
		display: flex;
		flex-direction: column;
		gap: var(--q-gap);
	}

	.print-page--preview {
		margin: 0 auto var(--space-4);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}

	.print-page--output {
		page-break-after: always;
		break-after: page;
	}

	.print-page--output:last-child {
		page-break-after: auto;
		break-after: auto;
	}

	.print-header {
		display: flex;
		flex-direction: column;
		gap: 1mm;
		padding-bottom: 2mm;
		border-bottom: 0.5pt solid #000000;
	}

	.print-header-test {
		font-size: 16pt;
		font-weight: 700;
	}

	.print-header-revision {
		font-size: var(--print-font);
		font-weight: 700;
	}

	.print-question {
		display: flex;
		flex-direction: column;
		gap: var(--qa-gap);
	}

	.print-question-text {
		display: flex;
	}

	.print-question-number {
		font-weight: 700;
		margin-right: 1.5mm;
		flex-shrink: 0;
	}

	.print-question-content {
		white-space: pre-wrap;
		min-width: 0;
	}

	.print-body {
		padding-left: var(--body-indent);
		display: flex;
		flex-direction: column;
		gap: var(--qa-gap);
	}

	.print-image {
		display: block;
		object-fit: contain;
		max-width: 100%;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}

	.print-image--side {
		flex-shrink: 0;
		align-self: flex-start;
	}

	.print-side {
		display: flex;
		align-items: flex-start;
		gap: var(--qa-gap);
	}

	.print-answers {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--qa-gap);
		min-width: 0;
	}

	.print-answers--inline {
		/* Beside a left-placed image, fill the remaining width so the answers
		   column reaches the right edge of the body. */
		flex: 1;
	}

	.print-answer {
		display: flex;
		align-items: flex-start;
		gap: 2mm;
		min-width: 0;
	}

	.print-answer-letter {
		font-weight: 700;
		flex-shrink: 0;
	}

	.print-answer-text {
		min-width: 0;
		overflow-wrap: break-word;
	}

	/* ---- Print output (unscaled, paginated into exact A4 pages) ---- */
	@page {
		size: A4;
		margin: 0;
	}

	@media print {
		:global(html),
		:global(body) {
			height: auto !important;
			margin: 0 !important;
			padding: 0 !important;
			background: #ffffff !important;
		}

		.print-measure {
			display: none !important;
		}

		.print-overlay {
			position: static !important;
			background: none !important;
			display: block !important;
		}

		.print-toolbar,
		.print-preview-scroll {
			display: none !important;
		}

		.print-output {
			display: block;
		}

		/* Keep only the print output visible during print. */
		:global(body),
		:global(body *) {
			visibility: hidden;
		}

		:global(.print-output),
		:global(.print-output *) {
			visibility: visible;
		}

		:global(.print-output) {
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
		}

		:global(.print-output) .print-page {
			box-shadow: none;
		}
	}
</style>
