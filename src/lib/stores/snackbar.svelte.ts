export type SnackFlavor = 'success' | 'info' | 'warn' | 'error';

export interface Snack {
	id: string;
	flavor: SnackFlavor;
	message: string;
	duration: number;
}

let nextId = 0;
let snacks = $state<Snack[]>([]);

export function getSnacks(): readonly Snack[] {
	return snacks;
}

export function pushSnack(flavor: SnackFlavor, message: string, duration = 4000): void {
	const id = `snack-${nextId++}`;
	const snack: Snack = { id, flavor, message, duration };
	snacks = [...snacks, snack];

	if (duration > 0) {
		setTimeout(() => {
			dismissSnack(id);
		}, duration);
	}
}

export function dismissSnack(id: string): void {
	snacks = snacks.filter((s) => s.id !== id);
}

export function snackSuccess(message: string, duration?: number): void {
	pushSnack('success', message, duration);
}

export function snackInfo(message: string, duration?: number): void {
	pushSnack('info', message, duration);
}

export function snackWarn(message: string, duration?: number): void {
	pushSnack('warn', message, duration);
}

export function snackError(message: string, duration?: number): void {
	pushSnack('error', message, duration);
}
