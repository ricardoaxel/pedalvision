import { afterEach, describe, expect, it, vi } from "vitest";
import { loadImageWithHeal } from "./loadImage";

/**
 * A stubbed `Image` whose load outcome depends on the URL: the **busted** URL
 * (`?pedalvision-v=1`) succeeds, the plain URL fails — the poisoned-cache case.
 * `constructed` counts attempts so tests can assert the retry happens exactly
 * once (and not at all for a URL that can't be busted).
 */
let constructed = 0;
class FakeImage {
	crossOrigin: string | null = null;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	#src = "";
	constructor() {
		constructed++;
	}
	set src(value: string) {
		this.#src = value;
		queueMicrotask(() => {
			if (value.includes("pedalvision-v=1")) this.onload?.();
			else this.onerror?.();
		});
	}
	get src(): string {
		return this.#src;
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("loadImageWithHeal", () => {
	it("retries once under a busted cache key when the CORS load fails", async () => {
		constructed = 0;
		vi.stubGlobal("Image", FakeImage);
		const image = await loadImageWithHeal("https://cdn.example.com/a.jpg");
		expect(image).toBeInstanceOf(FakeImage);
		// The successful (final) src is the busted one; exactly two attempts.
		expect((image as unknown as FakeImage).src).toContain("pedalvision-v=1");
		expect(constructed).toBe(2);
	});

	it("always loads crossOrigin so the canvas stays untainted", async () => {
		vi.stubGlobal("Image", FakeImage);
		const image = await loadImageWithHeal("https://cdn.example.com/a.jpg");
		expect((image as unknown as FakeImage).crossOrigin).toBe("anonymous");
	});

	it("rejects a same-origin path after a single attempt (no distinct key)", async () => {
		constructed = 0;
		vi.stubGlobal("Image", FakeImage);
		await expect(
			loadImageWithHeal("/pedal-assets/pedals/800/boss-tr-2.png"),
		).rejects.toThrow();
		// No bustable key → no retry.
		expect(constructed).toBe(1);
	});
});
