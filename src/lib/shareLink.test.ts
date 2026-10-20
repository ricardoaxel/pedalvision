import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import type { CustomPedal, PlacedBoard, PlacedItem } from "../state/scene";
import { capacityStatus } from "./capacity";
import {
	decodeShareHash,
	encodeShareLink,
	SHARE_BASE64_LIMIT_LENGTH,
	SHARE_DECODED_LIMIT_BYTES,
	type SharePayload,
} from "./shareLink";

const board = (uid: string, extra: Partial<PlacedBoard> = {}): PlacedBoard => ({
	uid,
	boardRefId: "boss-bcb-1000",
	x: 1.5,
	y: 2.5,
	rotationDeg: 12.5,
	...extra,
});

const item = (uid: string, extra: Partial<PlacedItem> = {}): PlacedItem => ({
	uid,
	refId: "boss-bd-2-blues-driver",
	kind: "pedal",
	boardUid: "board-1",
	x: 3.25,
	y: 4.75,
	rotationDeg: 45,
	z: 0,
	...extra,
});

const custom = (
	refId: string,
	extra: Partial<CustomPedal> = {},
): CustomPedal => ({
	refId,
	brand: "Acme",
	name: "My Fuzz",
	widthCm: 6.4,
	heightCm: 12.1,
	category: "pedal",
	effectTypes: ["fuzz"],
	jacks: [
		{ kind: "in", edge: "top", pos: 0.5 },
		{ kind: "out", edge: "bottom", pos: 0.25 },
	],
	power: { voltage: 9, acDc: "DC", currentMa: 20 },
	...extra,
});

function snapshot(
	overrides: Partial<SharePayload> = {},
): Pick<SharePayload, "boards" | "items" | "customPedals"> {
	return {
		boards: [board("board-1")],
		items: [item("item-1")],
		customPedals: [],
		...overrides,
	};
}

function hashOf(value: unknown): string {
	const compressed = deflateSync(strToU8(JSON.stringify(value)));
	return `#s=v1:${Buffer.from(compressed).toString("base64url")}`;
}

describe("share links (P3-03)", () => {
	it("round-trips boards, items, z-order and inline custom pedals", () => {
		const payload = snapshot({
			boards: [
				board("board-1"),
				board("board-2", {
					boardRefId: null,
					customSize: { widthCm: 60, heightCm: 40 },
					texture: "wood",
					name: "My board",
					brand: "Acme",
					x: -4,
					y: 8,
					rotationDeg: 33,
				}),
			],
			items: [
				item("item-1", { z: 2, rotationDeg: 15 }),
				item("item-2", {
					boardUid: null,
					refId: "custom-fuzz",
					x: 20,
					y: 10,
					z: 0,
					rotationDeg: 90,
				}),
			],
			customPedals: [custom("custom-fuzz")],
		});
		const encoded = encodeShareLink("Main board", payload);
		if (!encoded.ok) throw new Error("expected an encodable scene");
		const decoded = decodeShareHash(encoded.hash);
		if (!decoded.ok) throw new Error(decoded.message);
		expect(decoded.name).toBe("Main board");
		expect(decoded.snapshot.boards).toEqual(payload.boards);
		expect(decoded.snapshot.customPedals).toEqual(payload.customPedals);
		// Each container's z is re-normalised dense; the two items live in
		// different containers (board + loose), so both start at z=0.
		expect(decoded.snapshot.items.map((entry) => entry.uid)).toEqual([
			"item-1",
			"item-2",
		]);
		expect(decoded.snapshot.items.map((entry) => entry.z)).toEqual([0, 0]);
	});

	it("uses the #s=v1: prefix and base64url without padding", () => {
		const encoded = encodeShareLink("Main board", snapshot());
		if (!encoded.ok) throw new Error("expected an encodable scene");
		expect(encoded.hash.startsWith("#s=v1:")).toBe(true);
		const body = encoded.hash.slice("#s=v1:".length);
		expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(body).not.toContain("=");
	});

	it("rejects missing prefixes, other versions and empty bodies", () => {
		expect(decodeShareHash("")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(decodeShareHash("#nope")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(decodeShareHash("#s=")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(decodeShareHash("#s=v1:")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(decodeShareHash("#s=v2:abc")).toMatchObject({
			ok: false,
			reason: "unsupported-version",
		});
	});

	it("never throws on malformed or truncated input", () => {
		expect(decodeShareHash("#s=v1:!!!!")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(decodeShareHash("#s=v1:a")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(decodeShareHash(hashOf("not a scene"))).toMatchObject({
			ok: false,
			reason: "invalid",
		});
		expect(
			decodeShareHash(
				hashOf({ version: 1, boards: "nope", items: [], customPedals: [] }),
			),
		).toMatchObject({ ok: false, reason: "invalid" });

		const valid = encodeShareLink("Main board", snapshot());
		if (!valid.ok) throw new Error("expected an encodable scene");
		const truncated = valid.hash.slice(0, valid.hash.length - 8);
		expect(decodeShareHash(truncated)).toMatchObject({ ok: false });
	});

	it("caps the decoded payload (link bombs) and the encoded input", () => {
		const bomb = hashOf("x".repeat(SHARE_DECODED_LIMIT_BYTES + 10));
		expect(decodeShareHash(bomb)).toMatchObject({
			ok: false,
			reason: "too-large",
		});
		const hugeHash = `#s=v1:${"A".repeat(SHARE_BASE64_LIMIT_LENGTH + 1)}`;
		expect(decodeShareHash(hugeHash)).toMatchObject({
			ok: false,
			reason: "too-large",
		});
	});

	it("aborts a highly compressed link bomb instead of inflating it all", () => {
		const bomb = `#s=v1:${Buffer.from(
			deflateSync(new Uint8Array(8 * 1024 * 1024)),
		).toString("base64url")}`;
		expect(decodeShareHash(bomb)).toMatchObject({
			ok: false,
			reason: "too-large",
		});
	});

	it("refuses to encode an over-ceiling scene (never truncates)", () => {
		const customPedals = Array.from({ length: 1_200 }, (_, index) =>
			custom(`custom-${index}`, { name: "X".repeat(200) }),
		);
		const encoded = encodeShareLink("Huge", {
			boards: [],
			items: [],
			customPedals,
		});
		expect(encoded).toMatchObject({ ok: false, reason: "too-large" });
		if (encoded.ok) throw new Error("expected a refusal");
		expect(encoded.limitBytes).toBe(SHARE_DECODED_LIMIT_BYTES);
	});

	it("keeps an unknown refId and leaves the labeled fallback to the renderer", () => {
		const encoded = encodeShareLink("Unknown part", {
			boards: [board("board-1")],
			items: [item("item-1", { refId: "not-in-catalog" })],
			customPedals: [],
		});
		if (!encoded.ok) throw new Error("expected an encodable scene");
		const decoded = decodeShareHash(encoded.hash);
		if (!decoded.ok) throw new Error(decoded.message);
		expect(decoded.snapshot.items[0]?.refId).toBe("not-in-catalog");
	});

	it("loads an over-cap shared scene and reports it via capacityStatus", () => {
		const boards = Array.from({ length: 11 }, (_, index) =>
			board(`board-${index + 1}`),
		);
		const items = Array.from({ length: 401 }, (_, index) =>
			item(`item-${index + 1}`, {
				boardUid: boards[index % boards.length]?.uid ?? null,
				refId: `unknown-${index % 5}`,
			}),
		);
		const encoded = encodeShareLink("Over cap", {
			boards,
			items,
			customPedals: [],
		});
		if (!encoded.ok) throw new Error("expected an encodable over-cap scene");
		const decoded = decodeShareHash(encoded.hash);
		if (!decoded.ok) throw new Error(decoded.message);
		const status = capacityStatus(decoded.snapshot);
		expect(status.boards.over).toBe(true);
		expect(status.items.over).toBe(true);
		expect(status.level).toBe("hard");
	});

	it("keeps a max-cap scene under the ~200 KB share ceiling", () => {
		const boards = Array.from({ length: 10 }, (_, index) =>
			board(`board-${index + 1}`),
		);
		const customPedals = Array.from({ length: 100 }, (_, index) =>
			custom(`custom-${index}`, { name: `Custom part ${index}` }),
		);
		const items = Array.from({ length: 400 }, (_, index) =>
			item(`item-${index + 1}`, {
				boardUid: boards[index % boards.length]?.uid ?? null,
				refId:
					index % 4 === 0
						? (customPedals[index % customPedals.length]?.refId ?? "custom-0")
						: `boss-ref-${index % 50}`,
			}),
		);
		const encoded = encodeShareLink("Max scene", {
			boards,
			items,
			customPedals,
		});
		if (!encoded.ok) throw new Error("expected a max scene to fit");
		expect(encoded.decodedBytes).toBeLessThan(SHARE_DECODED_LIMIT_BYTES);
		expect(decodeShareHash(encoded.hash).ok).toBe(true);
	});

	it("de-duplicates repeated uids instead of producing colliding entries", () => {
		const decoded = decodeShareHash(
			hashOf({
				version: 1,
				name: "Dupes",
				boards: [board("board-1"), board("board-1", { x: 99 })],
				items: [
					item("item-1", { refId: "custom-a" }),
					item("item-1", { refId: "custom-a", z: 1 }),
				],
				customPedals: [custom("custom-a"), custom("custom-a")],
			}),
		);
		if (!decoded.ok) throw new Error(decoded.message);
		expect(decoded.snapshot.boards).toHaveLength(1);
		expect(decoded.snapshot.boards[0]?.x).toBe(1.5);
		expect(decoded.snapshot.items).toHaveLength(1);
		expect(decoded.snapshot.customPedals).toHaveLength(1);
	});
});
