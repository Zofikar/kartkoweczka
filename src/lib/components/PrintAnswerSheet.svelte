<script lang="ts">
	import {
		getOpenOmr,
		imageDataToPngDataUrl,
		openOmrImageToImageData,
		uuidToBytes,
	} from '@/utils/openOmr';
	import { SHEET_SIZE } from '@/utils/omrScanner';
	import { i18n } from '@/lib/i18n.svelte';
	import type { QuestionResponseRow } from '@/utils/questionResponses';

	interface Props {
		testName?: string;
		revisionName?: string;
		revisionId: string;
		responseRows?: QuestionResponseRow[];
	}

	let { testName = '', revisionName = '', revisionId, responseRows = [] }: Props = $props();
	let sheetDataUrl = $state('');
	let generationError = $state('');

	$effect(() => {
		let cancelled = false;
		generateAnswerSheet(revisionId, responseRows)
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

	async function generateAnswerSheet(id: string, rows: QuestionResponseRow[]): Promise<string> {
		const openOmr = await getOpenOmr();
		const generator = new openOmr.SheetGenerator();
		try {
			generator.initialize(SHEET_SIZE, uuidToBytes(id));
			for (const row of rows) {
				const labels = row.answerLabels.map((label) => new TextEncoder().encode(label));
				if (!generator.addQuestion(row.questionNumber, row.subQuestionNumber, labels)) {
					throw new Error(i18n.t('print.addQuestionError', { number: row.displayNumber }));
				}
			}

			const sheet = generator.generate();
			try {
				if (sheet.width === 0 || sheet.height === 0) {
					throw new Error(i18n.t('print.generationError'));
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

	<section class="student-details" aria-label={i18n.t('print.studentDetails')}>
		<div class="student-field">
			<span class="student-field-label">{i18n.t('print.studentName')}</span>
			<span class="student-field-line"></span>
		</div>
		<div class="student-field student-field--class">
			<span class="student-field-label">{i18n.t('print.class')}</span>
			<span class="student-field-line"></span>
		</div>
	</section>

	<section class="sheet-instructions" aria-label={i18n.t('print.instructions')}>
		<div class="marking-instruction">
			<div class="instruction-copy">
				<strong>{i18n.t('print.howToMark')}</strong>
				<span>{i18n.t('print.markDescription')}</span>
			</div>
			<div class="mark-examples">
				<div class="mark-example" aria-label={i18n.t('print.markExample')}>
					<strong>{i18n.t('print.mark')}</strong>
					<div class="answer-options" aria-hidden="true">
						<div class="answer-option">
							<span>A</span><span class="answer-cell"><span class="answer-cell-inner"></span></span>
						</div>
						<div class="answer-option">
							<span>B</span><span class="answer-cell answer-cell--selected"
								><span class="answer-cell-inner"></span></span
							>
						</div>
						<div class="answer-option">
							<span>C</span><span class="answer-cell"><span class="answer-cell-inner"></span></span>
						</div>
						<div class="answer-option">
							<span>D</span><span class="answer-cell"><span class="answer-cell-inner"></span></span>
						</div>
					</div>
				</div>
				<div class="mark-example" aria-label={i18n.t('print.correctionExample')}>
					<strong>{i18n.t('print.correction')}</strong>
					<div class="answer-options" aria-hidden="true">
						<div class="answer-option">
							<span>A</span><span class="answer-cell"><span class="answer-cell-inner"></span></span>
						</div>
						<div class="answer-option">
							<span>B</span><span class="answer-cell answer-cell--corrected"
								><span class="answer-cell-inner"></span></span
							>
						</div>
						<div class="answer-option">
							<span>C</span><span class="answer-cell answer-cell--selected"
								><span class="answer-cell-inner"></span></span
							>
						</div>
						<div class="answer-option">
							<span>D</span><span class="answer-cell"><span class="answer-cell-inner"></span></span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<p>
			{i18n.t('print.penInstruction')}
		</p>
	</section>

	{#if generationError}
		<p class="generation-error">{generationError}</p>
	{:else if sheetDataUrl}
		<img class="generated-sheet" src={sheetDataUrl} alt={i18n.t('print.generatedAlt')} />
	{:else}
		<p class="generation-status">{i18n.t('print.generating')}</p>
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

	.student-details {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 48mm;
		gap: 8mm;
		font-size: 11pt;
	}

	.student-field {
		display: flex;
		align-items: flex-end;
		gap: 2mm;
		min-width: 0;
	}

	.student-field-label {
		font-weight: 700;
		white-space: nowrap;
	}

	.student-field-line {
		flex: 1;
		min-width: 12mm;
		height: 4mm;
		border-bottom: 0.5pt solid #000000;
	}

	.sheet-instructions {
		display: flex;
		flex-direction: column;
		gap: 1.5mm;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 10pt;
		line-height: 1.3;
	}

	.sheet-instructions p {
		margin: 0;
	}

	.marking-instruction {
		display: flex;
		flex-direction: column;
		gap: 1.5mm;
	}

	.instruction-copy {
		display: flex;
		align-items: baseline;
		gap: 1.5mm;
	}

	.mark-examples {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8mm;
		width: 100%;
	}

	.mark-example {
		display: flex;
		align-items: center;
		gap: 1.5mm;
		font-size: 9pt;
		line-height: 1;
		white-space: nowrap;
	}

	.answer-options {
		display: flex;
		gap: 1mm;
	}

	.answer-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5mm;
		font-weight: 700;
	}

	.answer-cell {
		position: relative;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: 8.4mm;
		height: 8.4mm;
		border: 0.6pt solid #000000;
		background: #ffffff;
	}

	.answer-cell-inner {
		display: block;
		box-sizing: border-box;
		width: 4.2mm;
		height: 4.2mm;
		border: 0.6pt solid #000000;
	}

	.answer-cell--selected .answer-cell-inner {
		background: #000000;
	}

	.answer-cell--corrected {
		background: #000000;
	}

	.answer-cell--corrected .answer-cell-inner {
		visibility: hidden;
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
