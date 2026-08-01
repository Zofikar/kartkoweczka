<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Input from '@/lib/ui/Input.svelte';

	interface Props {
		image?: string | null;
		imageWidth?: number | null;
		imageHeight?: number | null;
		onchange?: (data: {
			image: string | null;
			imageWidth: number | null;
			imageHeight: number | null;
		}) => void;
	}

	let {
		image = $bindable(null),
		imageWidth = $bindable(null),
		imageHeight = $bindable(null),
		onchange,
	}: Props = $props();

	let fileInputEl: HTMLInputElement | undefined = $state();

	function notify() {
		onchange?.({ image, imageWidth, imageHeight });
	}

	function handleFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			image = reader.result as string;
			notify();
		};
		reader.readAsDataURL(file);

		// Reset so re-selecting same file triggers change
		input.value = '';
	}

	function removeImage() {
		image = null;
		imageWidth = null;
		imageHeight = null;
		notify();
	}

	function onWidthChange(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		imageWidth = val ? Number(val) : null;
		notify();
	}

	function onHeightChange(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		imageHeight = val ? Number(val) : null;
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
		<div class="image-preview-section">
			<img class="image-preview" src={image} alt="Podgląd obrazu" />
			<div class="image-size-controls">
				<label class="size-label">
					Szer. (px)
					<Input
						type="number"
						value={imageWidth?.toString() ?? ''}
						oninput={onWidthChange}
						placeholder="auto"
					/>
				</label>
				<label class="size-label">
					Wys. (px)
					<Input
						type="number"
						value={imageHeight?.toString() ?? ''}
						oninput={onHeightChange}
						placeholder="auto"
					/>
				</label>
			</div>
			<div class="image-actions">
				<Button variant="outline" size="sm" onclick={triggerFilePicker}>Zmień obraz</Button>
				<Button variant="accent" size="sm" onclick={removeImage}>Usuń obraz</Button>
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

	.image-preview-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.image-preview {
		max-width: 300px;
		max-height: 200px;
		object-fit: contain;
		border-radius: var(--radius-md);
		border: 1px solid var(--background-muted);
		background: var(--background);
		align-self: flex-start;
	}

	.image-size-controls {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.size-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		color: var(--text);
		max-width: 120px;
	}

	.image-actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
