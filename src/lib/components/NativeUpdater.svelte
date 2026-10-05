<script lang="ts">
	import { i18n } from '../i18n.svelte';
	import Button from '../ui/Button.svelte';
	import { snackInfo, snackError } from '../stores/snackbar.svelte';
	let busy = $state(false);
	let version = $state<string | null>(null);
	async function update(install: boolean) {
		if (busy) return;
		busy = true;
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			version = await invoke<string | null>('native_update', { install });
			if (!version) snackInfo(i18n.t('native.current'));
		} catch {
			snackError(i18n.t('native.updateError'));
		} finally {
			busy = false;
		}
	}
</script>

<aside aria-live="polite">
	{#if version}
		<Button disabled={busy} onclick={() => update(true)}>{i18n.t('native.update')} {version}</Button
		>
	{:else}
		<Button variant="outline" disabled={busy} onclick={() => update(false)}
			>{i18n.t('native.check')}</Button
		>
	{/if}
	{#if busy}<span>{i18n.t('common.loading')}</span>{/if}
</aside>

<style>
	aside {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
</style>
