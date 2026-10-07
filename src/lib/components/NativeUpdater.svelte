<script lang="ts">
	import { i18n } from '../i18n.svelte';
	import Button from '../ui/Button.svelte';
	import { pushSnack, replaceSnack } from '../stores/snackbar.svelte';
	let busy = $state(false);
	let version = $state<string | null>(null);
	async function update(install: boolean) {
		if (busy) return;
		busy = true;
		const snackId = pushSnack('info', i18n.t('common.loading'), 0);
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			version = await invoke<string | null>('native_update', { install });
			replaceSnack(
				snackId,
				'info',
				version ? i18n.t('native.available', { version }) : i18n.t('native.current')
			);
		} catch (error) {
			replaceSnack(
				snackId,
				'error',
				i18n.t(
					String(error).includes('android-install-permission')
						? 'native.installPermission'
						: 'native.updateError'
				)
			);
		} finally {
			busy = false;
		}
	}
</script>

<div class="native-updater" aria-busy={busy}>
	{#if version}
		<Button disabled={busy} onclick={() => update(true)}>{i18n.t('native.update')} {version}</Button
		>
	{:else}
		<Button variant="outline" disabled={busy} onclick={() => update(false)}
			>{i18n.t('native.check')}</Button
		>
	{/if}
</div>

<style>
	.native-updater :global(button) {
		width: 100%;
		height: auto;
		min-height: var(--control-h-md);
		padding: var(--space-2);
		white-space: normal;
		line-height: 1.5;
	}
</style>
