import { beforeEach, describe, expect, it } from "vitest";
import {
	type CableDragTarget,
	isCableTargetValid,
	useCableDrag,
} from "./cableDrag";

beforeEach(() => {
	useCableDrag.getState().cancel();
});

describe("cable drag state", () => {
	it("keeps the target reference stable when the snapped jack is unchanged", () => {
		useCableDrag.getState().begin({ itemUid: "a", jackIndex: 1 });
		const target: CableDragTarget = {
			kind: "item",
			uid: "b",
			jackIndex: 0,
		};
		useCableDrag.getState().update({ x: 1, y: 1 }, target);
		const first = useCableDrag.getState().target;
		// A new object with the same identity must not fan out subscribers.
		useCableDrag.getState().update(
			{ x: 2, y: 2 },
			{
				kind: "item",
				uid: "b",
				jackIndex: 0,
			},
		);
		expect(useCableDrag.getState().target).toBe(first);
		expect(useCableDrag.getState().pointerWorldCm).toEqual({ x: 2, y: 2 });
	});

	it("replaces the target when the snapped destination changes", () => {
		useCableDrag.getState().begin({ itemUid: "a", jackIndex: 1 });
		useCableDrag.getState().update(
			{ x: 1, y: 1 },
			{
				kind: "endpoint",
				uid: "amp",
			},
		);
		const first = useCableDrag.getState().target;
		useCableDrag.getState().update({ x: 2, y: 2 }, null);
		expect(first).not.toBeNull();
		expect(useCableDrag.getState().target).toBeNull();
	});

	it("rejects only the identical source jack", () => {
		const source = { itemUid: "a", jackIndex: 1 };
		expect(
			isCableTargetValid(source, { kind: "item", uid: "a", jackIndex: 0 }),
		).toBe(true);
		expect(
			isCableTargetValid(source, { kind: "item", uid: "a", jackIndex: 1 }),
		).toBe(false);
		expect(isCableTargetValid(source, { kind: "endpoint", uid: "x" })).toBe(
			true,
		);
	});
});
