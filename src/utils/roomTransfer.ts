import { joinRoom, type Room } from 'trystero';

/** Action namespace shared by the exporting and importing peers. */
export const TRANSFER_ACTION = 'kartkoweczka-test-transfer';

/** How long a transfer room stays alive before being torn down (short-lived). */
export const ROOM_TTL_MS = 5 * 60 * 1000;

/**
 * App identifier used to namespace rooms. Must be identical on both devices,
 * which is guaranteed because it is baked into the build from the environment.
 */
export const TRANSFER_APP_ID: string = import.meta.env.VITE_APP_ID ?? 'kartkoweczka';

/** Characters safe to read aloud and type — no 0/O/1/I lookalikes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a short, human-typable room code using a CSPRNG. */
export function generateRoomCode(length = 6): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let code = '';
	for (let i = 0; i < length; i++) {
		code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	}
	return code;
}

/** Normalizes a user-typed code: uppercases it and drops whitespace/separators. */
export function normalizeRoomCode(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Joins a transfer room and returns its handle. */
export function joinTransferRoom(roomCode: string): Room {
	return joinRoom({ appId: TRANSFER_APP_ID }, roomCode);
}
