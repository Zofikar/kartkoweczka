<script lang="ts">
	import { onDestroy } from 'svelte';
	import Modal from '@/lib/ui/Modal.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import { snackError, snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { ExportTestBinary, ExportTestJson } from '@/utils/transfer';
	import { buildFileName, downloadFile } from '@/utils/download';
	import {
		ROOM_TTL_MS,
		TRANSFER_ACTION,
		generateRoomCode,
		joinTransferRoom,
	} from '@/utils/roomTransfer';
	import type { MessageAction, Room } from 'trystero';
	import { i18n } from '@/lib/i18n.svelte';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		testId: string;
		testName: string;
	}

	let { open = false, onclose, testId, testName }: Props = $props();

	let exporting = $state(false);

	let roomCode = $state('');
	let roomStatus = $state<'idle' | 'waiting' | 'sending' | 'sent' | 'expired' | 'error'>('idle');
	let roomError = $state('');

	let room: Room | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		teardownRoom();
	});

	function close() {
		teardownRoom();
		resetRoomUi();
		onclose?.();
	}

	async function exportJson() {
		exporting = true;
		try {
			const json = await ExportTestJson(testId);
			downloadFile(buildFileName(testName, 'json'), json, 'application/json');
			snackSuccess(i18n.t('transfer.export.jsonSuccess'));
		} catch (err) {
			snackError(i18n.t('transfer.export.error'));
			console.error('Failed to export test (JSON):', err);
		} finally {
			exporting = false;
		}
	}

	async function exportBinary() {
		exporting = true;
		try {
			const bytes = await ExportTestBinary(testId);
			downloadFile(buildFileName(testName, 'kart'), bytes, 'application/octet-stream');
			snackSuccess(i18n.t('transfer.export.binarySuccess'));
		} catch (err) {
			snackError(i18n.t('transfer.export.error'));
			console.error('Failed to export test (binary):', err);
		} finally {
			exporting = false;
		}
	}

	function startRoom() {
		teardownRoom();
		resetRoomUi();
		roomCode = generateRoomCode();
		roomStatus = 'waiting';
		room = joinTransferRoom(roomCode);
		const action = room.makeAction<Uint8Array>(TRANSFER_ACTION);
		room.onPeerJoin = (peerId) => {
			if (roomStatus === 'sending' || roomStatus === 'sent') return;
			void sendToPeer(action, peerId);
		};
		timeoutId = setTimeout(() => {
			if (roomStatus === 'sent') {
				teardownRoom();
				return;
			}
			roomStatus = 'expired';
			teardownRoom();
		}, ROOM_TTL_MS);
	}

	async function sendToPeer(action: MessageAction<Uint8Array>, peerId: string) {
		try {
			roomStatus = 'sending';
			const bin = await ExportTestBinary(testId);
			await action.send(bin, { target: peerId });
			roomStatus = 'sent';
		} catch (err) {
			roomError = i18n.t('transfer.export.sendError');
			roomStatus = 'error';
			console.error('Failed to send test over room:', err);
		}
	}

	function teardownRoom() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		if (room) {
			room.onPeerJoin = null;
			room.onPeerLeave = null;
			Promise.resolve(room.leave()).catch(() => {});
			room = null;
		}
	}

	function resetRoomUi() {
		roomCode = '';
		roomStatus = 'idle';
		roomError = '';
	}
</script>

<Modal {open} onclose={close} title={i18n.t('transfer.export.title')}>
	<div class="modal-content">
		<Text variant="muted" as="span">
			{i18n.t('transfer.export.warning')}
		</Text>

		<Heading level={5}>{i18n.t('transfer.file')}</Heading>
		<div class="method-list">
			<Button variant="outline" onclick={exportJson} disabled={exporting}>
				{exporting ? i18n.t('transfer.export.exporting') : i18n.t('transfer.export.downloadJson')}
			</Button>
			<Button variant="outline" onclick={exportBinary} disabled={exporting}>
				{i18n.t('transfer.export.downloadBinary')}
			</Button>
		</div>

		<Divider />

		<Heading level={5}>{i18n.t('transfer.export.p2pTitle')}</Heading>
		<Text variant="muted">
			{i18n.t('transfer.export.p2pDescription')}
		</Text>

		{#if roomStatus === 'idle'}
			<Button variant="primary" onclick={startRoom}>{i18n.t('transfer.export.generateCode')}</Button
			>
		{:else}
			<div class="room-code-box">
				<Text variant="small">{i18n.t('transfer.roomCode')}</Text>
				<div class="room-code">{roomCode}</div>
			</div>

			{#if roomStatus === 'waiting'}
				<Text variant="muted">{i18n.t('transfer.export.waiting')}</Text>
			{:else if roomStatus === 'sending'}
				<Text variant="muted">{i18n.t('transfer.export.sending')}</Text>
			{:else if roomStatus === 'sent'}
				<Text>{i18n.t('transfer.export.sent')}</Text>
			{:else if roomStatus === 'expired'}
				<Text variant="error">{i18n.t('transfer.export.expired')}</Text>
				<Button variant="outline" size="sm" onclick={startRoom}
					>{i18n.t('transfer.export.newCode')}</Button
				>
			{:else if roomStatus === 'error'}
				<Text variant="error">{roomError}</Text>
			{/if}
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={close}>{i18n.t('common.close')}</Button>
	{/snippet}
</Modal>

<style>
	.modal-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.method-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.room-code-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-4);
		border-radius: var(--radius-md);
		background-color: var(--background-muted);
		text-align: center;
	}

	.room-code {
		font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
		font-size: var(--font-3xl);
		font-weight: var(--font-bold);
		letter-spacing: 0.25em;
		color: var(--text);
	}
</style>
