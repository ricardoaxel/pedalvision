import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { easeOutCubic, MOTION, motionMs } from "./motion";

const tokensCss = readFileSync(
	new URL("../styles/tokens.css", import.meta.url),
	"utf8",
);

describe("motion tokens", () => {
	it("mirrors the JS durations and travel in tokens.css", () => {
		expect(tokensCss).toContain(`--motion-fast: ${MOTION.fast}ms;`);
		expect(tokensCss).toContain(`--motion-base: ${MOTION.base}ms;`);
		expect(tokensCss).toContain(`--motion-slow: ${MOTION.slow}ms;`);
		expect(tokensCss).toContain(`--motion-distance: ${MOTION.distance}px;`);
		expect(tokensCss).toContain(`--motion-scale-in: ${MOTION.scaleIn};`);
		expect(tokensCss).toContain(`--motion-exit: ${MOTION.exit}ms;`);
		expect(tokensCss).toContain(`--motion-close: ${MOTION.close}ms;`);
		expect(tokensCss).toContain(`--motion-prime: ${MOTION.prime}ms;`);
		expect(tokensCss).toContain(`--motion-scale-out: ${MOTION.scaleOut};`);
	});

	it("zeroes every duration token under reduced motion", () => {
		const reduced = tokensCss.match(
			/@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/,
		)?.[1];
		expect(reduced).toBeDefined();
		expect(reduced).toContain("--motion-fast: 0ms;");
		expect(reduced).toContain("--motion-base: 0ms;");
		expect(reduced).toContain("--motion-slow: 0ms;");
		expect(reduced).toContain("--motion-exit: 0ms;");
		expect(reduced).toContain("--motion-close: 0ms;");
		expect(reduced).toContain("--motion-prime: 0ms;");
	});
});

describe("motionMs", () => {
	it("returns the duration when motion is allowed", () => {
		expect(motionMs(MOTION.slow, false)).toBe(240);
	});

	it("resolves to an instant state change under reduced motion", () => {
		expect(motionMs(MOTION.slow, true)).toBe(0);
		expect(motionMs(0, false)).toBe(0);
	});
});

describe("easeOutCubic", () => {
	it("starts at 0, ends at 1 and is monotonic", () => {
		expect(easeOutCubic(0)).toBe(0);
		expect(easeOutCubic(1)).toBe(1);
		expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
		expect(easeOutCubic(0.25)).toBeLessThan(easeOutCubic(0.75));
	});

	it("clamps out-of-range input", () => {
		expect(easeOutCubic(-1)).toBe(0);
		expect(easeOutCubic(2)).toBe(1);
	});
});
