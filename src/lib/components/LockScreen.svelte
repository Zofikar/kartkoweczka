<script lang="ts">
	import Heading from '../ui/Heading.svelte';
	import Text from '../ui/Text.svelte';
	import Button from '../ui/Button.svelte';
	import { i18n } from '../i18n.svelte';
	import NativeDownload from './NativeDownload.svelte';

	interface Props {
		deferredPrompt?: boolean;
		oninstall?: () => void;
		class?: never;
		[k: string]: unknown;
	}

	let { deferredPrompt = false, oninstall, ...restProps }: Props = $props();
</script>

<div class="lock-screen" {...restProps}>
	<Heading level={1}>{i18n.t('lock.title')}</Heading>
	<Text variant="body">{i18n.t('lock.description')}</Text>

	{#if deferredPrompt}
		<Button variant="primary" onclick={oninstall}>{i18n.t('lock.install')}</Button>
	{:else}
		<Text variant="muted">
			{i18n.t('lock.iosPrefix')} <strong>{i18n.t('lock.iosAction')}</strong>.
		</Text>
	{/if}
	<NativeDownload />
</div>

<style>
	.lock-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		text-align: center;
		padding: var(--space-8);
		height: 100%;
	}
</style>
