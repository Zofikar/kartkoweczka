<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import type { ImagePlacement } from '@/db/schema/types';
	import { computeImageMaxLines, computeImageMinLines } from '@/utils/paper';

	interface Props {
		image?: string | null;
		imageHeight?: number | null;
		imagePlacement?: ImagePlacement | null;
		answersCount?: number;
		onchange?: (data: {
			image: string | null;
			imageHeight: number | null;
			imagePlacement: ImagePlacement | null;
		}) => void;
	}

	let {
		image = $bindable(null),
		imageHeight = $bindable(null),
		imagePlacement = $bindable(null),
		answersCount = 0,
		onchange,
	}: Props = $props();

	let fileInputEl: HTMLInputElement | undefined = $state();

	/** Natural (intrinsic) dimensions of the uploaded image in pixels. */
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);

	const DEFAULT_LINES = 4;

	/** Effective placement used for bound computation (defaults to 'over'). */
	let effectivePlacement: 'over' | 'left' | 'right' = $derived(imagePlacement ?? 'over');

	/** Minimum image height in lines for the current placement. */
	let minLines = $derived(computeImageMinLines(effectivePlacement, answersCount));

	/**
	 * Maximum image height in lines, computed dynamically from the image's
	 * natural dimensions, current placement, and answer count.
	 */
	let maxLines = $derived(
		computeImageMaxLines(naturalWidth, naturalHeight, effectivePlacement, answersCount)
	);

	/** Clamp stored imageHeight so the slider stays within the computed range. */
	let clampedHeight = $derived(
		imageHeight != null ? Math.max(minLines, Math.min(imageHeight, maxLines)) : minLines
	);

	function notify() {
		onchange?.({ image, imageHeight, imagePlacement });
	}

	function handleFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			// Read natural dimensions from the loaded image.
			const img = new Image();
			img.onload = () => {
				naturalWidth = img.naturalWidth;
				naturalHeight = img.naturalHeight;
			};
			img.src = dataUrl;

			image = dataUrl;
			imageHeight = DEFAULT_LINES;
			notify();
		};
		reader.readAsDataURL(file);

		input.value = '';
	}

	function removeImage() {
		image = null;
		imageHeight = null;
		imagePlacement = null;
		naturalWidth = 0;
		naturalHeight = 0;
		notify();
	}

	function onHeightLinesChange(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		const lines = Number(val);
		imageHeight = lines > 0 ? lines : null;
		notify();
	}

	function onPlacementChange(value: ImagePlacement) {
		imagePlacement = value;
		notify();
	}

	function triggerFilePicker() {
		fileInputEl?.click();
	}
</script>

<div class="image-upload">
	<input
		type="file"
		accept="image/*"
		class="file-input-hidden"
		bind:this={fileInputEl}
		onchange={handleFileSelected}
	/>

	{#if image}
		<div class="image-preview-layout">
			<img class="image-preview" src={image} alt="Podgląd obrazu" />
			<div class="image-controls">
				<label class="control-label">
					<span class="control-label-text">
						Wysokość obrazu: {clampedHeight} linii
					</span>
					<input
						type="range"
						min={minLines}
						max={maxLines}
						step="1"
						value={clampedHeight}
						oninput={onHeightLinesChange}
						class="height-slider"
					/>
					<span class="control-hint">
						{minLines} &ndash; {maxLines} linii (domyślnie {DEFAULT_LINES})
					</span>
				</label>
				<fieldset class="placement-fieldset">
					<legend class="control-label-text">Położenie obrazu</legend>
					<div
						class="placement-options"
						role="radiogroup"
						aria-label="Położenie obrazu względem odpowiedzi"
					>
						<Button
							variant={imagePlacement === 'over' || !imagePlacement ? 'primary' : 'ghost'}
							size="sm"
							role="radio"
							aria-checked={imagePlacement === 'over' || !imagePlacement}
							onclick={() => onPlacementChange('over')}
						>
							Nad
						</Button>
						<Button
							variant={imagePlacement === 'left' ? 'primary' : 'ghost'}
							size="sm"
							role="radio"
							aria-checked={imagePlacement === 'left'}
							onclick={() => onPlacementChange('left')}
						>
							Lewo
						</Button>
						<Button
							variant={imagePlacement === 'right' ? 'primary' : 'ghost'}
							size="sm"
							role="radio"
							aria-checked={imagePlacement === 'right'}
							onclick={() => onPlacementChange('right')}
						>
							Prawo
						</Button>
					</div>
				</fieldset>
				<div class="image-actions">
					<Button variant="outline" size="sm" onclick={triggerFilePicker}>Zmień obraz</Button>
					<Button variant="danger" size="sm" onclick={removeImage}>Usuń obraz</Button>
				</div>
			</div>
		</div>
	{:else}
		<Button variant="outline" size="sm" onclick={triggerFilePicker}>+ Dodaj obraz</Button>
	{/if}
</div>

<style>
	.image-upload {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.file-input-hidden {
		display: none;
	}

	.image-preview-layout {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		align-items: flex-start;
	}

	.image-preview {
		max-width: 300px;
		max-height: 200px;
		object-fit: contain;
		border-radius: var(--radius-md);
		border: 1px solid var(--background-muted);
		background: var(--background);
		flex-shrink: 0;
	}

	.image-controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 200px;
		flex: 1;
	}

	.control-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.control-label-text {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		color: var(--text);
	}

	.control-hint {
		font-family: var(--font-sans);
		font-size: var(--font-xs);
		color: var(--text-muted);
	}

	.height-slider {
		width: 100%;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.placement-fieldset {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.placement-options {
		display: flex;
		gap: var(--space-1);
		align-self: flex-start;
	}

	.image-actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	/* Narrow screens: stack image and controls vertically */
	@media (max-width: 480px) {
		.image-preview-layout {
			flex-direction: column;
		}

		.image-preview {
			max-width: 100%;
		}

		.image-controls {
			min-width: 0;
			width: 100%;
		}
	}
</style>
