import { describe, expect, it, vi } from "vitest";

/**
 * The committed catalog has fewer than 250 image-bearing pedals, so the distinct
 * image hard cap can only be exercised with a synthetic catalog. Keep this in
 * its own file: `vi.mock` is module-scoped and would leak into the real-catalog
 * capacity tests.
 */
vi.mock("../catalog/load", () => {
	const pedals = Array.from({ length: 260 }, (_, index) => ({
		id: `pedal-${index}`,
		image: `pedal-${index}.png`,
		imageSource: "static" as const,
	}));
	return {
		catalog: {
			pedals,
			boards: [{ id: "board-0", image: "board.png", imageSource: "static" }],
		},
	};
});

import {
	addItemRefusal,
	type CapacityScene,
	capacityStatus,
	distinctImageCount,
	distinctImageUrls,
} from "./capacity";

function scene(items: CapacityScene["items"]): CapacityScene {
	return { boards: [], items, customPedals: [], cables: [], endpoints: [] };
}

function distinctItems(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		refId: `pedal-${index}`,
		kind: "pedal" as const,
	}));
}

describe("distinct image hard cap", () => {
	it("counts every distinct URL", () => {
		expect(distinctImageCount(scene(distinctItems(250)))).toBe(250);
	});

	it("warns softly at 150 distinct images", () => {
		const status = capacityStatus(scene(distinctItems(150)));
		expect(status.images.level).toBe("soft");
		expect(status.warning).toContain("approaching the image limit");
	});

	it("refuses a new distinct image at 250 but allows an image already placed", () => {
		const full = scene(distinctItems(250));
		expect(addItemRefusal(full, "pedal-259")).toContain("at the image limit");
		expect(addItemRefusal(full, "pedal-249")).toBeNull();
	});

	it("includes board art only for export sizing", () => {
		const value: CapacityScene = {
			boards: [{ boardRefId: "board-0" }],
			items: [{ refId: "pedal-0", kind: "pedal" }],
			customPedals: [],
		};
		expect(distinctImageUrls(value)).toHaveLength(1);
		expect(distinctImageUrls(value, true)).toHaveLength(2);
	});
});
