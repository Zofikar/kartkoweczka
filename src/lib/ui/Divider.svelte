<script lang="ts">
	interface Props {
		[k: string]: unknown;
	}

	let { ...restProps }: Props = $props();
</script>

<hr class="divider" {...restProps} />

<style>
	.divider {
		border: none;
		border-top: 1px solid var(--background-muted);
		margin: 0;
		width: 100%;
	}
</style>
