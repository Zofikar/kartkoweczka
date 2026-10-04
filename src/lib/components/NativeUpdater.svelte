<script lang="ts">
	import { i18n } from '../i18n.svelte';
	import Button from '../ui/Button.svelte';
	let busy = $state(false);
	let version = $state<string | null>(null);
	let message = $state('');
	async function update(install: boolean) {
		busy = true;
		message = '';
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			version = await invoke<string | null>('native_update', { install });
			if (!version) message = i18n.t('native.current');
		} catch {
			message = i18n.t('native.updateError');
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
		<Button disabled={busy} onclick={() => update(false)}>{i18n.t('native.check')}</Button>
	{/if}
	{#if busy}<span>{i18n.t('common.loading')}</span>{/if}
	{#if message}<span>{message}</span>{/if}
</aside>
