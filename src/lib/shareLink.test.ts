import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import type {
	Cable,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "../state/scene";
import type { SceneSnapshot } from "../state/sceneDocument";
import { capacityStatus } from "./capacity";
import {
	decodeShareHash,
	encodeShareLink,
	SHARE_BASE64_LIMIT_LENGTH,
	SHARE_DECODED_LIMIT_BYTES,
	SHARE_URL_HARD_LIMIT_CHARS,
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
		{ kind: "in", edge: "top", pos: 0.5, stereo: true },
		{ kind: "out", edge: "bottom", pos: 0.25 },
	],
	power: { voltage: 9, acDc: "DC", currentMa: 20 },
	...extra,
});

function snapshot(
	overrides: Partial<
		Pick<
			SharePayload,
			"boards" | "items" | "customPedals" | "endpoints" | "cables"
		>
	> = {},
): SceneSnapshot {
	return {
		boards: [board("board-1")],
		items: [item("item-1")],
		customPedals: [],
		endpoints: [],
		cables: [],
		...overrides,
	};
}

function hashOf(value: unknown, version = 2): string {
	const compressed = deflateSync(strToU8(JSON.stringify(value)));
	return `#s=v${version}:${Buffer.from(compressed).toString("base64url")}`;
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

	it("round-trips cables + endpoints and decodes a legacy v1 link", () => {
		const endpoint: Endpoint = {
			uid: "endpoint-amp",
			kind: "amp",
			x: 30,
			y: 12,
		};
		const cable: Cable = {
			uid: "cable-1",
			from: { itemUid: "item-1", jack: "1" },
			to: { endpointUid: "endpoint-amp" },
		};
		const payload = snapshot({
			customPedals: [custom("custom-fuzz")],
			items: [item("item-1", { refId: "custom-fuzz" })],
			endpoints: [endpoint],
			cables: [cable],
		});
		const encoded = encodeShareLink("Patched", payload);
		if (!encoded.ok) throw new Error("expected an encodable scene");
		const decoded = decodeShareHash(encoded.hash);
		if (!decoded.ok) throw new Error(decoded.message);
		expect(decoded.snapshot.endpoints).toEqual([endpoint]);
		expect(decoded.snapshot.cables).toEqual([cable]);

		// A P3-era v1 link has no graph keys; it still opens with an empty graph.
		const legacy = decodeShareHash(
			hashOf(
				{
					version: 1,
					name: "Legacy",
					boards: [board("board-1")],
					items: [item("item-1")],
					customPedals: [],
				},
				1,
			),
		);
		if (!legacy.ok) throw new Error(legacy.message);
		expect(legacy.name).toBe("Legacy");
		expect(legacy.snapshot.endpoints).toEqual([]);
		expect(legacy.snapshot.cables).toEqual([]);
	});

	it("uses the #s=v2: prefix and base64url without padding", () => {
		const encoded = encodeShareLink("Main board", snapshot());
		if (!encoded.ok) throw new Error("expected an encodable scene");
		expect(encoded.hash.startsWith("#s=v2:")).toBe(true);
		const body = encoded.hash.slice("#s=v2:".length);
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
			reason: "corrupt",
		});
		expect(decodeShareHash("#s=v3:abc")).toMatchObject({
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
			endpoints: [],
			cables: [],
		});
		expect(encoded).toMatchObject({ ok: false, reason: "too-large" });
		if (encoded.ok) throw new Error("expected a refusal");
		expect(encoded.limitBytes).toBe(SHARE_DECODED_LIMIT_BYTES);
	});

	it("re-measures the share-URL budget with a graph (do not raise the cap)", () => {
		const graphSnapshot = (
			itemCount: number,
			cableCount: number,
			endpointCount: number,
		): SceneSnapshot => {
			const items = Array.from({ length: itemCount }, (_, index) =>
				item(`item-${index}`, {
					refId: `pedal-${index % 207}`,
					boardUid: null,
					x: (index % 20) * 9 + (index % 7) * 0.37,
					y: Math.floor(index / 20) * 9 + (index % 11) * 0.29,
					rotationDeg: (index * 17) % 360,
				}),
			);
			const endpoints = Array.from({ length: endpointCount }, (_, index) => ({
				uid: `endpoint-${index}`,
				kind: index % 2 === 0 ? ("amp" as const) : ("instrument" as const),
				x: 200 + index,
				y: 20,
			}));
			const cables = Array.from({ length: cableCount }, (_, index) => ({
				uid: `cable-${index}`,
				from: {
					itemUid: items[index % items.length]?.uid ?? "item-0",
					jack: "1",
				},
				to: {
					itemUid: items[(index + 1) % items.length]?.uid ?? "item-1",
					jack: "0",
				},
			}));
			return { boards: [], items, customPedals: [], endpoints, cables };
		};

		// 100 / 200 items + a graph stay comfortably encodable.
		const hundred = encodeShareLink("Graph 100", graphSnapshot(100, 50, 50));
		if (!hundred.ok) throw new Error(hundred.message);
		expect(hundred.hash.length).toBeLessThan(SHARE_URL_HARD_LIMIT_CHARS);

		const twoHundred = encodeShareLink("Graph 200", graphSnapshot(200, 75, 75));
		if (!twoHundred.ok) throw new Error(twoHundred.message);
		expect(twoHundred.hash.length).toBeLessThan(SHARE_URL_HARD_LIMIT_CHARS);

		// At the graph cap the 32,000-char hard cap can bind (the P4-01 note
		// measured 400 items + 200 cables + 100 endpoints at 38,184 chars). Record
		// either outcome — the cap must not be raised for the benchmark.
		const maxGraph = encodeShareLink("Graph 400", graphSnapshot(400, 200, 100));
		if (maxGraph.ok) {
			expect(maxGraph.hash.length).toBeLessThanOrEqual(
				SHARE_URL_HARD_LIMIT_CHARS,
			);
		} else {
			expect(maxGraph.reason).toBe("too-large");
			expect(maxGraph.hashLength).toBeGreaterThan(SHARE_URL_HARD_LIMIT_CHARS);
		}
	});

	it("keeps an unknown refId and leaves the labeled fallback to the renderer", () => {
		const encoded = encodeShareLink("Unknown part", {
			boards: [board("board-1")],
			items: [item("item-1", { refId: "not-in-catalog" })],
			customPedals: [],
			endpoints: [],
			cables: [],
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
			endpoints: [],
			cables: [],
		});
		if (!encoded.ok) throw new Error("expected an encodable over-cap scene");
		const decoded = decodeShareHash(encoded.hash);
		if (!decoded.ok) throw new Error(decoded.message);
		const status = capacityStatus(decoded.snapshot);
		expect(status.boards.over).toBe(true);
		expect(status.items.over).toBe(true);
		expect(status.level).toBe("hard");
	});

	it("keeps a 1,500-item share link under the 32K URL cap", () => {
		const boards = Array.from({ length: 10 }, (_, index) =>
			board(`board-${index + 1}`),
		);
		const items = Array.from({ length: 1_500 }, (_, index) =>
			item(`item-${index + 1}`, {
				boardUid: boards[index % boards.length]?.uid ?? null,
				refId: `catalog-${index % 200}`,
				x: index % 80,
				y: Math.floor(index / 80),
				z: index,
			}),
		);
		const encoded = encodeShareLink("Large board", {
			boards,
			items,
			customPedals: [],
			endpoints: [],
			cables: [],
		});
		if (!encoded.ok) throw new Error("expected a 1,500-item link to fit");
		expect(encoded.hash.length).toBeLessThanOrEqual(SHARE_URL_HARD_LIMIT_CHARS);
		const decoded = decodeShareHash(encoded.hash);
		if (!decoded.ok) throw new Error(decoded.message);
		expect(decoded.snapshot.items).toHaveLength(1_500);
	});

	it("refuses a link that would exceed the 32K delivery cap", () => {
		const boards = Array.from({ length: 10 }, () => board(crypto.randomUUID()));
		const items = Array.from({ length: 700 }, (_, index) =>
			item(crypto.randomUUID(), {
				refId: `random-${crypto.randomUUID()}`,
				boardUid: boards[index % boards.length]?.uid ?? null,
				x: index,
				y: index * 2,
				z: index,
			}),
		);
		const encoded = encodeShareLink("Too long", {
			boards,
			items,
			customPedals: [],
			endpoints: [],
			cables: [],
		});
		expect(encoded).toMatchObject({ ok: false, reason: "too-large" });
		if (encoded.ok) throw new Error("expected a refusal");
		expect(encoded.hashLength).toBeGreaterThan(SHARE_URL_HARD_LIMIT_CHARS);
		expect(encoded.message).toContain("too long");
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
			endpoints: [],
			cables: [],
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
