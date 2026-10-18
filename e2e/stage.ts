import type { Page } from "@playwright/test";

const PX_PER_CM = 4;

export interface Footprint {
	widthCm: number;
	heightCm: number;
}

function rotate(point: { x: number; y: number }, deg: number) {
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: point.x * cos - point.y * sin,
		y: point.x * sin + point.y * cos,
	};
}

/**
 * The screen-space centre (viewport px) of the FIRST placed item, derived from
 * the Stage's debug attributes. Correct for loose and board-attached (rotated)
 * items, and **independent of the info rail's width** — needed since P2-03's
 * desktop rail "pushes" the canvas narrower than the window, so a click at the
 * window centre no longer lands on a pedal placed before the rail opened.
 */
export async function firstItemScreenCentre(
	page: Page,
	size: Footprint,
): Promise<{ x: number; y: number }> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;

	const parent = ((await stage.getAttribute("data-item-parents")) ?? "").split(
		",",
	)[0];
	const [ix, iy] = (
		((await stage.getAttribute("data-item-positions")) ?? "").split(";")[0] ??
		""
	)
		.split(",")
		.map(Number);
	const itemRot =
		Number(
			((await stage.getAttribute("data-item-rotations")) ?? "").split(",")[0],
		) || 0;

	let rotation = itemRot;
	let origin = { x: ix, y: iy };
	if (parent !== "loose") {
		const index = Number(parent);
		const [bx, by] = (
			((await stage.getAttribute("data-positions")) ?? "").split(";")[index] ??
			""
		)
			.split(",")
			.map(Number);
		const boardRot =
			Number(
				((await stage.getAttribute("data-rotations")) ?? "").split(",")[index],
			) || 0;
		const rotated = rotate(origin, boardRot);
		origin = { x: rotated.x + bx, y: rotated.y + by };
		rotation = boardRot + itemRot;
	}

	const half = rotate({ x: size.widthCm / 2, y: size.heightCm / 2 }, rotation);
	const world = { x: origin.x + half.x, y: origin.y + half.y };
	return {
		x: box.x + world.x * PX_PER_CM * scale + vx,
		y: box.y + world.y * PX_PER_CM * scale + vy,
	};
}
