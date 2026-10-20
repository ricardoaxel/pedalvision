import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "./download";

describe("dataUrlToBlob", () => {
	it("decodes a base64 PNG data URL with its MIME type", async () => {
		const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
		const base64 = btoa(String.fromCharCode(...bytes));
		const blob = dataUrlToBlob(`data:image/png;base64,${base64}`);
		expect(blob.type).toBe("image/png");
		expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
	});

	it("defaults a missing MIME type and rejects non-data/plain payloads", () => {
		const blob = dataUrlToBlob("data:;base64,QQ==");
		expect(blob.type).toBe("application/octet-stream");
		expect(
			dataUrlToBlob("data:text/plain;charset=utf-8;base64,QQ==").type,
		).toBe("text/plain");
		expect(() => dataUrlToBlob("https://example.com/a.png")).toThrow();
		expect(() => dataUrlToBlob("data:text/plain,hello")).toThrow();
	});
});
