import { describe, expect, it } from "vitest";
import { parseSceneDocument, type SceneSnapshot } from "../state/sceneDocument";
import { backupFileName, buildSceneBackup } from "./sceneBackup";

function snapshot(): SceneSnapshot {
	return {
		boards: [
			{
				uid: "board-1",
				boardRefId: "boss-bcb-1000",
				x: 12.5,
				y: -3,
				rotationDeg: 30,
			},
		],
		items: [
			{
				uid: "item-1",
				refId: "boss-bd-2-blues-driver",
				kind: "pedal",
				boardUid: "board-1",
				x: 1.5,
				y: 2.25,
				rotationDeg: 45,
				z: 0,
			},
		],
		customPedals: [
			{
				refId: "custom-1",
				brand: "My Brand",
				name: "Fuzz",
				widthCm: 6,
				heightCm: 12,
				category: "pedal",
				effectTypes: ["fuzz"],
			},
		],
		endpoints: [{ uid: "amp-1", kind: "amp", x: 60, y: 20 }],
		cables: [
			{
				uid: "cable-1",
				from: { itemUid: "item-1", jack: "0" },
				to: { endpointUid: "amp-1" },
			},
		],
	};
}

const NOW = new Date(2026, 9, 20, 15, 30);

describe("scene backup", () => {
	it("round-trips through the SceneDocument v1 parser", () => {
		const backup = buildSceneBackup({
			id: "scene-1",
			name: "Verse rig",
			snapshot: snapshot(),
			now: NOW,
		});
		const parsed = parseSceneDocument(JSON.parse(backup.json));
		expect(parsed).not.toBeNull();
		expect(parsed).toMatchObject({
			id: "scene-1",
			version: 1,
			name: "Verse rig",
			updatedAt: NOW.toISOString(),
		});
		expect(parsed?.boards).toEqual(snapshot().boards);
		expect(parsed?.items).toEqual(snapshot().items);
		expect(parsed?.customPedals).toEqual(snapshot().customPedals);
		expect(parsed?.endpoints).toEqual(snapshot().endpoints);
		expect(parsed?.cables).toEqual(snapshot().cables);
	});

	it("reflects unsaved live edits at build time", () => {
		const live = snapshot();
		live.items.push({
			uid: "item-2",
			refId: "custom-1",
			kind: "pedal",
			boardUid: "board-1",
			x: 8,
			y: 9,
			rotationDeg: 0,
			z: 1,
		});
		const backup = buildSceneBackup({
			id: "scene-1",
			name: "Verse rig",
			snapshot: live,
			now: NOW,
		});
		const parsed = parseSceneDocument(JSON.parse(backup.json));
		expect(parsed?.items).toHaveLength(2);
		expect(parsed?.items[1]).toMatchObject({ uid: "item-2", x: 8, y: 9 });
	});

	it("builds a safe filename from the scene name + local date", () => {
		expect(backupFileName("Verse rig", NOW)).toBe("verse-rig-2026-10-20.json");
		expect(backupFileName("  Café / Pedalboard #2  ", NOW)).toBe(
			"cafe-pedalboard-2-2026-10-20.json",
		);
		expect(backupFileName("../../etc/passwd", NOW)).toBe(
			"etc-passwd-2026-10-20.json",
		);
		expect(backupFileName("", NOW)).toBe("pedalvision-scene-2026-10-20.json");
		expect(backupFileName("   ", NOW)).toBe(
			"pedalvision-scene-2026-10-20.json",
		);
	});

	it("bounds a long name and keeps the extension", () => {
		const name = "x".repeat(200);
		const filename = backupFileName(name, NOW);
		expect(filename).toMatch(/^x{48}-2026-10-20\.json$/);
	});

	it("has no write side effects on the live scene", () => {
		const live = snapshot();
		const before = JSON.stringify(live);
		buildSceneBackup({
			id: "scene-1",
			name: "Verse rig",
			snapshot: live,
			now: NOW,
		});
		expect(JSON.stringify(live)).toBe(before);
	});
});
