import { decompressSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeDemoHash } from "./encode.ts";
import type { DemoSnapshot } from "./layout.ts";

const snapshot: DemoSnapshot = {
	boards: [
		{
			uid: "b1",
			boardRefId: "aclam-smart-track-l2-free",
			x: 0,
			y: 0,
			rotationDeg: 0,
		},
	],
	items: [
		{
			uid: "i1",
			refId: "meris-enzo",
			kind: "pedal",
			boardUid: "b1",
			x: 1.5,
			y: 1.5,
			rotationDeg: 0,
			z: 0,
		},
	],
	customPedals: [],
	endpoints: [],
	cables: [],
};

function decode(hash: string) {
	const body = hash.slice("#s=v2:".length);
	return JSON.parse(
		strFromU8(decompressSync(Buffer.from(body, "base64url"))),
	) as {
		version: number;
		name: string;
		boards: unknown[];
		items: Array<{ refId: string }>;
	};
}

describe("encodeDemoHash", () => {
	it("encodes the same v2 payload shape the app decodes", () => {
		const payload = decode(encodeDemoHash("Batch demo", snapshot));
		expect(payload.version).toBe(2);
		expect(payload.name).toBe("Batch demo");
		expect(payload.boards).toHaveLength(1);
		expect(payload.items[0]?.refId).toBe("meris-enzo");
	});

	it("trims the scene name to the app limit", () => {
		expect(
			decode(encodeDemoHash("x".repeat(80), snapshot)).name.length,
		).toBeLessThanOrEqual(48);
	});
});
