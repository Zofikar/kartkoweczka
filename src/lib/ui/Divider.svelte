<script lang="ts">
	interface Props {
		class?: never;
		[k: string]: unknown;
	}

	let { ...restProps }: Props = $props();
</script>

<hr {...restProps} class="divider" />

<style>
	.divider {
		border: none;
		border-top: 1px solid var(--background-muted);
		margin: 0;
		width: 100%;
	}
</style>
