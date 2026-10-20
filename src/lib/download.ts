/**
 * Convert a `canvas.toDataURL()` payload to a Blob.
 *
 * Why: iOS Safari's `<a download>` is unreliable with `data:` URLs — large
 * photographic PNGs (multi-MB base64) can silently fail to save, while smaller
 * ones appear to work. Object URLs backed by a Blob do not have that size
 * limitation and are the recommended cross-iOS path.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
	const separator = dataUrl.indexOf(",");
	if (!dataUrl.startsWith("data:") || separator === -1) {
		throw new Error("Not a data URL");
	}
	const header = dataUrl.slice(5, separator);
	const mime = header.split(";")[0] || "application/octet-stream";
	if (!header.includes(";base64")) {
		throw new Error("Only base64 data URLs are supported");
	}
	const binary = atob(dataUrl.slice(separator + 1));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return new Blob([bytes], { type: mime });
}
