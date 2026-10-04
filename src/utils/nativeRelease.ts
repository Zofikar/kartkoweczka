export const nativePlatforms = ['Windows_x64', 'Linux_x64', 'Linux_arm', 'Android_arm'] as const;
export type NativePlatform = (typeof nativePlatforms)[number];
export interface NativeRelease {
	version: string;
	downloads: Partial<Record<NativePlatform, string | null>>;
	packages?: Partial<Record<NativePlatform, { deb?: string }>>;
}

interface BrowserPlatformData {
	platform: string;
	getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string }>;
}

export async function detectNativePlatform(): Promise<NativePlatform | null> {
	const data = (navigator as Navigator & { userAgentData?: BrowserPlatformData }).userAgentData;
	const ua = navigator.userAgent;
	const platform = data?.platform ?? navigator.platform;
	let architecture = '';
	let bitness = '';
	try {
		const hints = await data?.getHighEntropyValues?.(['architecture', 'bitness']);
		architecture = hints?.architecture ?? '';
		bitness = hints?.bitness ?? '';
	} catch {
		// Browsers may deny high-entropy hints; use explicit UA evidence only.
	}
	const arm64 = (architecture === 'arm' && bitness === '64') || /aarch64|arm64/i.test(ua);
	const x64 = (architecture === 'x86' && bitness === '64') || /x86_64|x64|Win64|amd64/i.test(ua);
	if (/Android/i.test(ua) || platform === 'Android') return arm64 ? 'Android_arm' : null;
	if (/Win/i.test(platform)) return x64 ? 'Windows_x64' : null;
	if (/Linux/i.test(platform)) return arm64 ? 'Linux_arm' : x64 ? 'Linux_x64' : null;
	return null;
}

export async function loadNativeRelease(signal: AbortSignal): Promise<NativeRelease> {
	// GitHub's API supplies CORS headers; release-download redirects do not reliably do so.
	const response = await fetch(
		'https://api.github.com/repos/Zofikar/kartkoweczka/releases/latest',
		{ signal, cache: 'no-store' }
	);
	if (response.status === 404) return { version: '', downloads: {} };
	if (!response.ok) throw new Error('Release metadata unavailable');
	const release = await response.json();
	const embedded = /<!-- native-manifest -->\s*```json\s*([\s\S]*?)```/.exec(release.body ?? '');
	if (!embedded) throw new Error('Download manifest unavailable');
	const manifest = JSON.parse(embedded[1]);
	if (typeof manifest.version !== 'string' || !manifest.downloads) {
		throw new Error('Invalid download manifest');
	}
	const downloads: NativeRelease['downloads'] = {};
	const packages: NonNullable<NativeRelease['packages']> = {};
	for (const platform of nativePlatforms) {
		const url = manifest.downloads[platform];
		if (typeof url === 'string' && new URL(url).protocol === 'https:') downloads[platform] = url;
		const deb = manifest.packages?.[platform]?.deb;
		if (typeof deb === 'string' && new URL(deb).protocol === 'https:') {
			packages[platform] = { deb };
		}
	}
	return { version: manifest.version, downloads, packages };
}
