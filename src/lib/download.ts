/**
 * Blob download helper (P3-01 export, reused by the P3-05 JSON backup).
 * Never use a `data:` URL: iOS Safari silently refuses large data-URL
 * downloads. The object URL is kept alive long enough for the save sheet, then
 * released (a save can otherwise be dropped when the URL is revoked too early).
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.rel = "noopener";
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
