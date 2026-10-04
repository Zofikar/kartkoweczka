<script lang="ts">
	import {
		getOpenOmr,
		imageDataToPngDataUrl,
		openOmrImageToImageData,
		uuidToBytes,
	} from '@/utils/openOmr';
	import { SHEET_SIZE } from '@/utils/omrScanner';

	interface Props {
		testName?: string;
		revisionName?: string;
		revisionId: string;
		answersPerQuestion?: number[];
	}

	let { testName = '', revisionName = '', revisionId, answersPerQuestion = [] }: Props = $props();
	let sheetDataUrl = $state('');
	let generationError = $state('');

	$effect(() => {
		let cancelled = false;
		generateAnswerSheet(revisionId, answersPerQuestion)
			.then((dataUrl) => {
				if (!cancelled) sheetDataUrl = dataUrl;
			})
			.catch((error) => {
				if (!cancelled) generationError = error instanceof Error ? error.message : String(error);
			});
		return () => {
			cancelled = true;
		};
	});

	async function generateAnswerSheet(id: string, answerCounts: number[]): Promise<string> {
		const openOmr = await getOpenOmr();
		const generator = new openOmr.SheetGenerator();
		try {
			generator.initialize(SHEET_SIZE, uuidToBytes(id));
			for (let index = 0; index < answerCounts.length; index++) {
				const labels = Array.from({ length: answerCounts[index] }, (_, answerIndex) =>
					new TextEncoder().encode(String.fromCharCode(65 + answerIndex))
				);
				if (!generator.addQuestion(index + 1, 0, labels)) {
					throw new Error(`Nie udało się dodać pytania ${index + 1} do karty odpowiedzi.`);
				}
			}

			const sheet = generator.generate();
			try {
				if (sheet.width === 0 || sheet.height === 0) {
					throw new Error('Nie udało się wygenerować karty odpowiedzi.');
				}
				return imageDataToPngDataUrl(openOmrImageToImageData(openOmr, sheet));
			} finally {
				sheet.data.delete();
			}
		} finally {
			generator.delete();
		}
	}
</script>

<div class="answer-sheet">
	<header class="sheet-header">
		<div class="sheet-header-test">{testName}</div>
		<div class="sheet-header-revision">{revisionName}</div>
	</header>

	{#if generationError}
		<p class="generation-error">{generationError}</p>
	{:else if sheetDataUrl}
		<img class="generated-sheet" src={sheetDataUrl} alt="Karta odpowiedzi" />
	{:else}
		<p class="generation-status">Generowanie karty odpowiedzi…</p>
	{/if}
</div>

<style>
	.answer-sheet {
		font-family: Georgia, 'Times New Roman', Times, serif;
		color: #000000;
		display: flex;
		flex-direction: column;
		gap: 4mm;
		height: 100%;
	}

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

	.generated-sheet {
		display: block;
		width: 180mm;
		height: 205mm;
		object-fit: contain;
		align-self: center;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}

	.generation-status,
	.generation-error {
		margin: auto;
		text-align: center;
	}

	.generation-error {
		color: #b91c1c;
	}
</style>
