export interface BuildVersion {
	version: string;
	displayVersion: string;
	commit: string;
	dirty: boolean;
}
export const stableTag: RegExp;
export function git(args: string[], cwd?: string): string;
export function androidVersionCode(version: string): number;
export function resolveVersion(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): BuildVersion;
