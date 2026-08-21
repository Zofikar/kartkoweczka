export function isRunningAsPWA() {
	if (import.meta.env.DEV) return true;

	if (typeof window === 'undefined') return false;

	// iOS only
	if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true;

	return window.matchMedia('(display-mode: standalone)').matches;
}
