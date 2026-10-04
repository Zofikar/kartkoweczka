<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n } from '../i18n.svelte';
	import {
		detectNativePlatform,
		loadNativeRelease,
		nativePlatforms,
		type NativePlatform,
		type NativeRelease,
	} from '../../utils/nativeRelease';
	let platform = $state<NativePlatform | ''>('');
	let release = $state<NativeRelease | null>(null);
	let failed = $state(false);
	let loading = $state(true);
	const download = $derived(platform ? release?.downloads[platform] : null);
	const deb = $derived(platform ? release?.packages?.[platform]?.deb : null);
	onMount(() => {
		const controller = new AbortController();
		void detectNativePlatform().then((detected) => {
			platform = detected ?? '';
		});
		void loadNativeRelease(controller.signal)
			.then((value) => {
				release = value;
			})
			.catch(() => {
				if (!controller.signal.aborted) failed = true;
			})
			.finally(() => {
				loading = false;
			});
		return () => controller.abort();
	});
</script>

<section aria-live="polite">
	<p>{i18n.t('native.alternative')}</p>
	<label>
		{i18n.t('native.platform')}
		<select bind:value={platform}>
			<option value="">{i18n.t('native.unknown')}</option>
			{#each nativePlatforms as option (option)}
				<option value={option}>{option} {option.endsWith('_arm') ? '(ARM64)' : ''}</option>
			{/each}
		</select>
	</label>
	{#if loading}
		<p>{i18n.t('common.loading')}</p>
	{:else if failed}
		<p>{i18n.t('native.error')}</p>
	{:else if download}
		<p>
			<a href={download} target="_blank" rel="noopener noreferrer"
				>{i18n.t('native.download')} {release?.version} — {platform}</a
			>
		</p>
		{#if deb}
			<p>
				<a href={deb} target="_blank" rel="noopener noreferrer"
					>{i18n.t('native.download')} {release?.version} — Debian 12 / Ubuntu 24.04 (.deb)</a
				>
			</p>
		{/if}
	{:else}
		<p>{i18n.t('native.unavailable')}</p>
	{/if}
</section>
