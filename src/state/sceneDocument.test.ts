import { describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import type {
	Cable,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "./scene";
import {
	createSceneDocument,
	normalizeSceneContent,
	parseSceneDocument,
	type SceneSnapshot,
	sceneFromDocument,
} from "./sceneDocument";

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");

const board: PlacedBoard = {
	uid: "b1",
	boardRefId: boss.id,
	x: 1,
	y: 2,
	rotationDeg: 0,
};

const item = (overrides: Partial<PlacedItem> = {}): PlacedItem => ({
	uid: "i1",
	refId: "boss-bd-2-blues-driver",
	kind: "pedal",
	boardUid: "b1",
	x: 3,
	y: 4,
	rotationDeg: 45,
	z: 0,
	...overrides,
});

const customPedal: CustomPedal = {
	refId: "custom-abc",
	brand: "Acme",
	name: "My Fuzz",
	widthCm: 6,
	heightCm: 12,
	category: "pedal",
	effectTypes: ["fuzz"],
	jacks: [
		{ kind: "in", edge: "top", pos: 0.5 },
		{ kind: "out", edge: "bottom", pos: 0.5 },
	],
	power: { voltage: 9, acDc: "DC", currentMa: 20 },
};

type SnapshotInput = Pick<SceneSnapshot, "boards" | "items" | "customPedals"> &
	Partial<Pick<SceneSnapshot, "endpoints" | "cables">>;

function documentOf(snapshot: SnapshotInput) {
	return createSceneDocument({
		id: "scene-1",
		name: "My board",
		updatedAt: "2026-10-19T12:00:00.000Z",
		endpoints: [],
		cables: [],
		...snapshot,
	});
}

describe("scene documents", () => {
	it("round-trips boards, items, inline custom pedals and z-order", () => {
		const document = documentOf({
			boards: [board],
			items: [item(), item({ uid: "i2", z: 1, rotationDeg: 0 })],
			customPedals: [customPedal],
		});
		expect(parseSceneDocument(document)).toEqual(document);
		expect(parseSceneDocument(JSON.stringify(document))).toEqual(document);
	});

	it("rejects corrupt / incomplete / unknown-version documents", () => {
		const document = documentOf({
			boards: [],
			items: [],
			customPedals: [],
		});
		expect(parseSceneDocument(null)).toBeNull();
		expect(parseSceneDocument("")).toBeNull();
		expect(parseSceneDocument("{ not json")).toBeNull();
		expect(parseSceneDocument({ ...document, version: 2 })).toBeNull();
		expect(parseSceneDocument({ ...document, id: "" })).toBeNull();
		expect(parseSceneDocument({ ...document, name: 4 })).toBeNull();
		expect(parseSceneDocument({ ...document, updatedAt: 4 })).toBeNull();
		expect(parseSceneDocument({ ...document, boards: {} })).toBeNull();
		expect(parseSceneDocument({ ...document, items: {} })).toBeNull();
	});

	it("drops malformed entries instead of failing the whole document", () => {
		const raw = {
			...documentOf({ boards: [], items: [], customPedals: [] }),
			boards: [board, { uid: 5 }],
			items: [item(), { refId: "x" }],
		};
		expect(parseSceneDocument(raw)).toEqual({
			id: "scene-1",
			version: 1,
			name: "My board",
			boards: [board],
			items: [item()],
			customPedals: [],
			endpoints: [],
			cables: [],
			updatedAt: "2026-10-19T12:00:00.000Z",
		});
	});

	it("treats customPedals as additive and drops malformed definitions", () => {
		const raw = {
			...documentOf({ boards: [], items: [], customPedals: [] }),
			customPedals: [
				customPedal,
				{ refId: "custom-bad", widthCm: -1 },
				{ ...customPedal, refId: "custom-jack", jacks: [{ kind: "banana" }] },
			],
		};
		expect(parseSceneDocument(raw)?.customPedals).toEqual([customPedal]);

		const withoutField = documentOf({
			boards: [],
			items: [],
			customPedals: [],
		});
		const { customPedals: _unused, ...legacy } = withoutField;
		expect(parseSceneDocument(legacy)?.customPedals).toEqual([]);
	});

	it("loads an over-cap recovered scene instead of rejecting it (P3-06)", () => {
		// A stored/shared scene may exceed the product budgets after catalog or
		// cap changes. Parsing must keep every object; only adding is guarded.
		const boards = Array.from({ length: 11 }, (_, index) => ({
			...board,
			uid: `b${index + 1}`,
			boardRefId: null,
			customSize: { widthCm: 40, heightCm: 20 },
			texture: "matte" as const,
		}));
		const items = Array.from({ length: 401 }, (_, index) =>
			item({ uid: `i${index + 1}`, boardUid: "b1" }),
		);
		const document = documentOf({ boards, items, customPedals: [] });
		const loaded = parseSceneDocument(document);
		if (!loaded) throw new Error("over-cap scene must load");
		expect(loaded.boards).toHaveLength(11);
		expect(loaded.items).toHaveLength(401);
		expect(sceneFromDocument(loaded).items).toHaveLength(401);
	});

	it("round-trips an inline custom board with its finish", () => {
		const customBoard: PlacedBoard = {
			uid: "b2",
			boardRefId: null,
			customSize: { widthCm: 80, heightCm: 40 },
			texture: "wood",
			name: "Big Rig",
			brand: "Acme",
			x: 3,
			y: 4,
			rotationDeg: 15,
		};
		expect(
			parseSceneDocument(
				documentOf({ boards: [customBoard], items: [], customPedals: [] }),
			)?.boards,
		).toEqual([customBoard]);
	});

	it("drops invalid custom boards and enforces the inline invariant", () => {
		const raw = {
			...documentOf({ boards: [], items: [], customPedals: [] }),
			boards: [
				{
					uid: "ok",
					boardRefId: null,
					customSize: { widthCm: 80, heightCm: 40 },
					texture: "matte",
					x: 0,
					y: 0,
					rotationDeg: 0,
				},
				// A custom board (no ref) must carry a bounded customSize.
				{ uid: "no-size", boardRefId: null, x: 0, y: 0, rotationDeg: 0 },
				{
					uid: "too-big",
					boardRefId: null,
					customSize: { widthCm: 1e308, heightCm: 40 },
					x: 0,
					y: 0,
					rotationDeg: 0,
				},
				// A catalog board must NOT carry a stray customSize.
				{
					uid: "catalog-stretched",
					boardRefId: boss.id,
					customSize: { widthCm: 999, heightCm: 999 },
					x: 0,
					y: 0,
					rotationDeg: 0,
				},
				{
					uid: "bad-texture",
					boardRefId: null,
					customSize: { widthCm: 80, heightCm: 40 },
					texture: "velvet",
					x: 0,
					y: 0,
					rotationDeg: 0,
				},
			],
		};
		expect(
			parseSceneDocument(raw)?.boards.map((candidate) => candidate.uid),
		).toEqual(["ok"]);
	});
});

describe("normalizing a loaded document", () => {
	it("drops orphaned items, densifies z and prunes unreferenced customs", () => {
		const normalized = normalizeSceneContent({
			boards: [board],
			endpoints: [],
			cables: [],
			items: [
				item({ uid: "ok", boardUid: "b1", z: 5 }),
				item({ uid: "orphan", boardUid: "gone", z: 2 }),
				item({
					uid: "custom",
					refId: "custom-abc",
					boardUid: null,
					z: 9,
				}),
			],
			customPedals: [customPedal],
		});
		expect(normalized.items.map((candidate) => candidate.uid)).toEqual([
			"ok",
			"custom",
		]);
		expect(normalized.items.map((candidate) => candidate.z)).toEqual([0, 0]);
		expect(normalized.customPedals).toHaveLength(1);
	});

	it("prunes a custom definition whose placed item was dropped with its board", () => {
		const normalized = normalizeSceneContent({
			boards: [],
			endpoints: [],
			cables: [],
			items: [item({ refId: "custom-abc", boardUid: "gone" })],
			customPedals: [customPedal],
		});
		expect(normalized.items).toHaveLength(0);
		expect(normalized.customPedals).toHaveLength(0);
	});

	it("sceneFromDocument applies the same normalization", () => {
		const document = documentOf({
			boards: [board],
			items: [item({ boardUid: "gone" })],
			customPedals: [customPedal],
		});
		expect(sceneFromDocument(document)).toEqual({
			boards: [board],
			items: [],
			customPedals: [],
			endpoints: [],
			cables: [],
		});
	});
});

describe("cables and endpoints (P4-01)", () => {
	const endpoint: Endpoint = {
		uid: "amp-1",
		kind: "amp",
		x: 60,
		y: 20,
	};
	const cable: Cable = {
		uid: "cable-1",
		from: { itemUid: "i1", jack: "1" },
		to: { endpointUid: "amp-1" },
	};

	const customItem = item({ refId: "custom-abc" });

	it("round-trips cables and endpoints through the document codec", () => {
		const document = documentOf({
			boards: [board],
			items: [customItem],
			customPedals: [customPedal],
			endpoints: [endpoint],
			cables: [cable],
		});
		expect(parseSceneDocument(document)).toEqual(document);
		expect(parseSceneDocument(JSON.stringify(document))).toEqual(document);
		expect(sceneFromDocument(document)).toEqual({
			boards: [board],
			items: [customItem],
			customPedals: [customPedal],
			endpoints: [endpoint],
			cables: [cable],
		});
	});

	it("keeps the additive v1 rule: documents without the arrays stay valid", () => {
		const document = documentOf({
			boards: [board],
			items: [item()],
			customPedals: [],
		});
		const { endpoints: _endpoints, cables: _cables, ...legacy } = document;
		expect(parseSceneDocument(legacy)).toMatchObject({
			endpoints: [],
			cables: [],
		});
	});

	it("drops malformed endpoints/cables instead of failing the document", () => {
		const raw = {
			...documentOf({ boards: [board], items: [item()], customPedals: [] }),
			endpoints: [endpoint, { uid: "bad" }, { ...endpoint, kind: "mic" }],
			cables: [
				cable,
				{ uid: "no-ends" },
				{
					uid: "mixed",
					from: { itemUid: "i1", jack: "0", endpointUid: "x" },
					to: { endpointUid: "amp-1" },
				},
			],
		};
		const parsed = parseSceneDocument(raw);
		expect(parsed?.endpoints).toEqual([endpoint]);
		expect(parsed?.cables).toEqual([cable]);
	});

	it("keeps a standalone endpoint (a placed object) across normalisation", () => {
		const spare: Endpoint = {
			uid: "spare",
			kind: "instrument",
			x: -10,
			y: 5,
		};
		const normalized = normalizeSceneContent({
			boards: [board],
			items: [customItem],
			customPedals: [customPedal],
			endpoints: [spare],
			cables: [],
		});
		expect(normalized.endpoints).toEqual([spare]);
		expect(normalized.cables).toEqual([]);
	});

	it("drops cables whose item/endpoint/jack is gone and the endpoints they orphan", () => {
		const normalized = normalizeSceneContent({
			boards: [board],
			items: [customItem],
			customPedals: [customPedal],
			endpoints: [
				endpoint,
				{ uid: "dangling", kind: "instrument", x: 0, y: 0 },
			],
			cables: [
				cable,
				{
					uid: "gone-item",
					from: { itemUid: "gone", jack: "0" },
					to: { endpointUid: "dangling" },
				},
				{
					uid: "gone-endpoint",
					from: { itemUid: "i1", jack: "0" },
					to: { endpointUid: "missing" },
				},
				{
					uid: "bad-jack",
					from: { itemUid: "i1", jack: "9" },
					to: { endpointUid: "amp-1" },
				},
			],
		});
		expect(normalized.items.map((entry) => entry.uid)).toEqual(["i1"]);
		expect(normalized.cables).toEqual([cable]);
		expect(normalized.endpoints).toEqual([endpoint]);
	});
});
