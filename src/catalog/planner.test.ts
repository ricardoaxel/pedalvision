import { afterAll, describe, expect, it, vi } from "vitest";
import { catalog } from "./load";
import {
	isPlannerBoard,
	isPlannerPedal,
	loadPlannerBoards,
	loadPlannerCatalog,
} from "./planner";

const valid = {
	id: "test-planner-pedal",
	brand: "Test",
	name: "Planner Pedal",
	widthCm: 7,
	heightCm: 12,
	image: "test-planner-pedal.avif",
	imageSource: "static",
	effectTypes: ["utility"],
	category: "pedal",
	source: "public-asset",
	confidence: "unsure",
	notes: "Planner placeholder",
};

afterAll(() => {
	vi.unstubAllGlobals();
});

describe("planner overlay", () => {
	it("merges valid records once and rejects malformed/duplicate records", async () => {
		const curatedId = catalog.pedals[0]?.id;
		if (!curatedId) throw new Error("curated catalog is empty");
		const before = catalog.pedals.length;
		const board = {
			id: "test-planner-board",
			brand: "Test",
			name: "Planner Board",
			widthCm: 60,
			heightCm: 30,
			image: "test-planner-board.avif",
			imageSource: "static",
			category: "board",
			source: "public-asset",
			confidence: "unsure",
			notes: "Planner placeholder",
		};
		const boardsBefore = catalog.boards.length;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => ({
				ok: true,
				json: async () =>
					String(url).includes("planner-boards")
						? [board, { ...board, id: "bad-board", image: "../evil.avif" }]
						: [
								valid,
								{ ...valid, id: "bad-image", image: "../evil.avif" },
								{ ...valid, id: "bad-size", widthCm: 0 },
								{ ...valid, id: curatedId },
							],
			})),
		);

		await loadPlannerCatalog();
		await loadPlannerBoards();
		expect(catalog.pedals.length).toBe(before + 1);
		expect(catalog.boards.length).toBe(boardsBefore + 1);
		expect(isPlannerBoard(board.id)).toBe(true);
		expect(isPlannerBoard("bad-board")).toBe(false);
		expect(isPlannerPedal(valid.id)).toBe(true);
		expect(
			catalog.pedals.filter((pedal) => pedal.id === valid.id),
		).toHaveLength(1);
		expect(isPlannerPedal("bad-image")).toBe(false);
		expect(isPlannerPedal("bad-size")).toBe(false);

		await loadPlannerCatalog();
		await loadPlannerBoards();
		expect(catalog.pedals.length).toBe(before + 1);
		expect(catalog.boards.length).toBe(boardsBefore + 1);
		expect(isPlannerBoard(board.id)).toBe(true);
		expect(isPlannerBoard("bad-board")).toBe(false);
	});
});
