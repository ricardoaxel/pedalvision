import { describe, expect, it } from "vitest";
import type { PlacedBoard } from "../state/scene";
import {
	changeBoardDraftUnits,
	draftFromCustomBoard,
	emptyCustomBoardDraft,
	MAX_BOARD_DIMENSION_CM,
	setBoardDraftDimension,
	validateCustomBoardDraft,
} from "./customBoard";

describe("custom board draft dimensions", () => {
	it("parses a display string to canonical cm and back through the toggle", () => {
		let draft = emptyCustomBoardDraft("cm");
		draft = setBoardDraftDimension(draft, "width", "6");
		draft = setBoardDraftDimension(draft, "depth", "12.7");
		expect(draft.widthCm).toBe(6);
		expect(draft.depthCm).toBe(12.7);

		const imperial = changeBoardDraftUnits(draft, "in");
		expect(imperial.width).toBe("2.36");
		expect(imperial.depth).toBe("5");
		// Switching units never changes the stored size.
		expect(imperial.widthCm).toBe(6);
		expect(imperial.depthCm).toBe(12.7);

		const backToCm = changeBoardDraftUnits(imperial, "cm");
		expect(backToCm.width).toBe("6");
		expect(backToCm.depth).toBe("12.7");
	});

	it("keeps an invalid dimension verbatim on a unit switch", () => {
		const draft = setBoardDraftDimension(
			emptyCustomBoardDraft("cm"),
			"width",
			"x",
		);
		const imperial = changeBoardDraftUnits(draft, "in");
		expect(imperial.width).toBe("x");
		expect(imperial.widthCm).toBeNull();
	});
});

describe("validateCustomBoardDraft", () => {
	const valid = () => {
		let draft = emptyCustomBoardDraft("cm");
		draft = setBoardDraftDimension(draft, "width", "80");
		draft = setBoardDraftDimension(draft, "depth", "40");
		draft = { ...draft, texture: "wood", name: "  Big Rig  ", brand: "Acme" };
		return draft;
	};

	it("accepts a valid draft and trims the identity fields", () => {
		const result = validateCustomBoardDraft(valid());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({
				widthCm: 80,
				heightCm: 40,
				texture: "wood",
				name: "Big Rig",
				brand: "Acme",
			});
		}
	});

	it("treats name and brand as optional", () => {
		const draft = valid();
		const result = validateCustomBoardDraft({
			...draft,
			name: "  ",
			brand: "",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBeUndefined();
			expect(result.value.brand).toBeUndefined();
		}
	});

	it("rejects a non-positive or missing dimension", () => {
		const draft = valid();
		expect(
			validateCustomBoardDraft({ ...draft, width: "", widthCm: null }).ok,
		).toBe(false);
		expect(
			validateCustomBoardDraft({ ...draft, depth: "-4", depthCm: null }).ok,
		).toBe(false);
	});

	it("rejects an over-large dimension", () => {
		const draft = valid();
		const result = validateCustomBoardDraft({
			...draft,
			width: String(MAX_BOARD_DIMENSION_CM + 1),
			widthCm: MAX_BOARD_DIMENSION_CM + 1,
		});
		expect(result.ok).toBe(false);
	});
});

describe("draftFromCustomBoard", () => {
	const board: PlacedBoard = {
		uid: "b1",
		boardRefId: null,
		customSize: { widthCm: 80, heightCm: 40 },
		texture: "tolex",
		name: "Big Rig",
		brand: "Acme",
		x: 0,
		y: 0,
		rotationDeg: 0,
	};

	it("seeds the draft exactly, so an untouched save is bit-identical", () => {
		const draft = draftFromCustomBoard(board, "cm");
		expect(draft).toMatchObject({
			brand: "Acme",
			name: "Big Rig",
			width: "80",
			depth: "40",
			widthCm: 80,
			depthCm: 40,
			texture: "tolex",
		});
		const result = validateCustomBoardDraft(draft);
		expect(result.ok && result.value.widthCm).toBe(80);
	});

	it("falls back to the default finish and blank dimensions when missing", () => {
		const bare: PlacedBoard = {
			uid: "b2",
			boardRefId: null,
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		const draft = draftFromCustomBoard(bare);
		expect(draft.texture).toBe("matte");
		expect(draft.widthCm).toBeNull();
		expect(draft.depthCm).toBeNull();
	});
});
