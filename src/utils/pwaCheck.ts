export function isRunningAsPWA() {
	if (typeof window === 'undefined') return false;

	// iOS only
	if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true;

	return window.matchMedia('(display-mode: standalone)').matches;
}
