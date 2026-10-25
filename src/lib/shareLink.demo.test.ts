import { describe, expect, it } from "vitest";
import { encodeDemoHash } from "../../tools/catalog-demo/encode.ts";
import {
	boardSnapshot,
	cablePlan,
	chooseBoard,
	itemSnapshots,
} from "../../tools/catalog-demo/layout.ts";
import pedalData from "../catalog/data/pedals.json";
import { decodeShareHash } from "./shareLink.ts";

describe("catalog:demo-link payload", () => {
	it("decodes through the real app codec (small scene)", () => {
		const items = [
			{
				id: "meris-enzo",
				widthCm: 10.8,
				heightCm: 11.43,
				category: "pedal" as const,
				jacks: [{ kind: "in" }, { kind: "out" }],
			},
			{
				id: "meris-hedra",
				widthCm: 10.8,
				heightCm: 11.43,
				category: "pedal" as const,
				jacks: [{ kind: "in" }, { kind: "out" }],
			},
		];
		const { board, pack } = chooseBoard(items, [
			{ id: "aclam-smart-track-l2-free", widthCm: 83.06, heightCm: 29.97 },
		]);
		const plan = cablePlan(items);
		const hash = encodeDemoHash("Demo", {
			boards: [boardSnapshot(board)],
			items: itemSnapshots(items, pack),
			customPedals: [],
			endpoints: [],
			cables: plan.cables,
		});
		const decoded = decodeShareHash(hash);
		expect(decoded.ok).toBe(true);
		if (!decoded.ok) return;
		expect(decoded.name).toBe("Demo");
		expect(decoded.snapshot.boards).toHaveLength(1);
		expect(decoded.snapshot.items).toHaveLength(2);
		expect(decoded.snapshot.cables).toHaveLength(1);
	});

	it("produces a codec-valid custom board for a 25-pedal batch", () => {
		const items = (
			pedalData as Array<{
				id: string;
				widthCm: number;
				heightCm: number;
				category: "pedal" | "supply";
				jacks?: Array<{ kind: string }>;
			}>
		)
			.slice(0, 25)
			.map((pedal) => ({
				id: pedal.id,
				widthCm: pedal.widthCm,
				heightCm: pedal.heightCm,
				category: pedal.category,
				jacks: pedal.jacks,
			}));
		const { board, pack } = chooseBoard(items, []);
		expect(board.boardRefId).toBeNull();
		expect(board.widthCm).toBeLessThanOrEqual(200);
		expect(board.heightCm).toBeLessThanOrEqual(200);
		const hash = encodeDemoHash("25 batch", {
			boards: [boardSnapshot(board)],
			items: itemSnapshots(items, pack),
			customPedals: [],
			endpoints: [],
			cables: cablePlan(items).cables,
		});
		const decoded = decodeShareHash(hash);
		expect(decoded.ok).toBe(true);
		if (!decoded.ok) return;
		expect(decoded.snapshot.boards).toHaveLength(1);
		expect(decoded.snapshot.items).toHaveLength(25);
		expect(decoded.snapshot.cables).toHaveLength(24);
	});
});
