import { describe, expect, it } from "vitest";
import { useMotion } from "./motion";

describe("transient canvas motion", () => {
	it("a pulse is transient and clears only its own nonce", () => {
		useMotion.getState().pulseItem("item-a", "add");
		const first = useMotion.getState().pulse;
		expect(first).toMatchObject({ uid: "item-a", kind: "add" });

		useMotion.getState().pulseItem("item-b", "duplicate");
		const second = useMotion.getState().pulse;
		expect(second).toMatchObject({ uid: "item-b", kind: "duplicate" });
		expect(second?.nonce).not.toBe(first?.nonce);

		// A stale clear (the first node's timer) must not wipe the new pulse.
		useMotion.getState().clearPulse(first?.nonce ?? -1);
		expect(useMotion.getState().pulse?.uid).toBe("item-b");

		useMotion.getState().clearPulse(second?.nonce ?? -1);
		expect(useMotion.getState().pulse).toBeNull();
	});

	it("a delete for an unknown item never creates a ghost", () => {
		useMotion.getState().departItem("does-not-exist");
		expect(useMotion.getState().ghost).toBeNull();
	});
});
