<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Pixels per millimetre at the CSS reference DPI (96). */
	const PX_PER_MM = 96 / 25.4;

	interface Props {
		/** Width of the internal design coordinate space (arbitrary units). */
		designWidth: number;
		/** Height of the internal design coordinate space (arbitrary units). */
		designHeight: number;
		/**
		 * Physical width the canvas should occupy, in millimetres.
		 *
		 * Use this for print content: the scale factor is then derived from a
		 * constant instead of a measurement, so it stays correct even when the
		 * element is only laid out for printing (e.g. inside a `display: none`
		 * print subtree where no JavaScript measurement can run).
		 *
		 * When omitted, the canvas fills its container's width and the scale is
		 * measured from the rendered element (screen use).
		 */
		widthMm?: number;
		children?: Snippet;
		class?: string;
	}

	let { designWidth, designHeight, widthMm, children, class: className = '' }: Props = $props();

	let containerWidth = $state(0);

	let scale = $derived(
		widthMm !== undefined
			? (widthMm * PX_PER_MM) / designWidth
			: containerWidth > 0
				? containerWidth / designWidth
				: 0
	);

	let canRenderStage = $derived(widthMm !== undefined || scale > 0);
</script>

<div
	class="fixed-canvas {className}"
	style:width={widthMm !== undefined ? `${widthMm}mm` : '100%'}
	style:aspect-ratio="{designWidth} / {designHeight}"
	bind:clientWidth={containerWidth}
>
	{#if canRenderStage}
		<div
			class="fixed-canvas-stage"
			style:width="{designWidth}px"
			style:height="{designHeight}px"
			style:transform="scale({scale})"
		>
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.fixed-canvas {
		position: relative;
		overflow: hidden;
	}

	.fixed-canvas-stage {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
	}
</style>
