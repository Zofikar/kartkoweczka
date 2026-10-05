<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n } from '../i18n.svelte';
	import Select from '../ui/Select.svelte';
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
	<Select
		label={i18n.t('native.platform')}
		value={platform}
		onchange={(event) =>
			(platform = (event.target as HTMLSelectElement).value as NativePlatform | '')}
		options={[
			{ value: '', label: i18n.t('native.unknown') },
			...nativePlatforms.map((option) => ({
				value: option,
				label: `${option}${option.endsWith('_arm') ? ' (ARM64)' : ''}`,
			})),
		]}
	/>
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

<style>
	section {
		color: var(--text);
	}

	a {
		color: var(--secondary);
	}
</style>
