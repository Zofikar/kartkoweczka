/** Replaces whitespace and path-invalid characters with dashes to build a safe file name. */
export function buildFileName(name: string, extension: string): string {
	const base =
		name
			.trim()
			.replace(/[\\/:*?"<>|\s]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'test';
	return `${base}.${extension}`;
}

/** Triggers a browser download of the given content (text or binary). */
export function downloadFile(
	filename: string,
	content: string | Uint8Array,
	mimeType: string
): void {
	const blob = new Blob([content as BlobPart], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
