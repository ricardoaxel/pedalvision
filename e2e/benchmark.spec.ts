import { readFileSync, statSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

/**
 * P3-06 capacity benchmark — **report-only** (run with `pnpm bench:capacity`).
 *
 * Distinct image-bearing items, not item count or document bytes, are the real
 * memory driver. This seeds the library directly in IndexedDB (adding 400 items
 * through the UI would dominate the run) and logs one table with:
 * items, distinct images, doc bytes, boot, heap, fps and export ms/bytes/spec.
 *
 * No ms thresholds are asserted — only structural facts (the export clamps
 * under 16.7 MP / 8192 px and downloads a valid PNG). Timing rows are for
 * humans comparing runs, not a flaky CI gate.
 */

interface CatalogPedal {
	id: string;
	category: "pedal" | "supply";
	imageSource: "mock" | "static" | "url";
}

const catalogPedals = JSON.parse(
	readFileSync("src/catalog/data/pedals.json", "utf8"),
) as CatalogPedal[];

/**
 * The 89 **same-origin** image-bearing catalog items (mock/static pedals +
 * supplies). Hotlinked `url` items are excluded so benchmark timings measure
 * decode + draw work, not the network. The committed seed has exactly 89.
 */
const DISTINCT_PEDALS = catalogPedals
	.filter(
		(item, index, all) =>
			item.imageSource !== "url" &&
			all.findIndex((candidate) => candidate.id === item.id) === index,
	)
	.slice(0, 89);

const REPEATED_PEDALS = DISTINCT_PEDALS.slice(0, 7);

interface FixtureBoard {
	uid: string;
	boardRefId: null;
	customSize: { widthCm: number; heightCm: number };
	texture: "matte";
	name: string;
	x: number;
	y: number;
	rotationDeg: number;
}

interface FixtureItem {
	uid: string;
	refId: string;
	kind: "pedal" | "supply";
	boardUid: string;
	x: number;
	y: number;
	rotationDeg: number;
	z: number;
}

interface SceneRow {
	id: string;
	name: string;
	version: 1;
	boards: FixtureBoard[];
	items: FixtureItem[];
	customPedals: [];
	updatedAt: string;
}

/** `count` boards laid out in a 5-column grid, each 200×200 cm. */
function makeBoards(count: number): FixtureBoard[] {
	return Array.from({ length: count }, (_, index) => ({
		uid: `board-${index}`,
		boardRefId: null,
		customSize: { widthCm: 200, heightCm: 200 },
		texture: "matte",
		name: `Bench ${index + 1}`,
		x: (index % 5) * 210,
		y: Math.floor(index / 5) * 210,
		rotationDeg: 0,
	}));
}

/** Distribute `count` items across `boards` using the given refs (cycled). */
function makeItems(
	count: number,
	boards: FixtureBoard[],
	refs: CatalogPedal[],
): FixtureItem[] {
	const perBoard = Math.ceil(count / boards.length);
	return Array.from({ length: count }, (_, index) => {
		const boardIndex = Math.min(
			boards.length - 1,
			Math.floor(index / perBoard),
		);
		const local = index % perBoard;
		return {
			uid: `item-${index}`,
			refId: refs[index % refs.length].id,
			kind: refs[index % refs.length].category,
			boardUid: boards[boardIndex].uid,
			// 20×20 grid at 9.5 cm pitch keeps a 400-item fixture inside its
			// 200×200 cm board (the item origins stay <= 182.5 cm).
			x: 2 + (local % 20) * 9.5,
			y: 2 + Math.floor(local / 20) * 9.5,
			rotationDeg: 0,
			z: index,
		};
	});
}

function scene(
	name: string,
	itemCount: number,
	boardCount: number,
	refs: CatalogPedal[],
	index = 0,
): SceneRow {
	const boards = makeBoards(boardCount);
	return {
		id: `bench-${index}`,
		name,
		version: 1,
		boards,
		items: makeItems(itemCount, boards, refs),
		customPedals: [],
		updatedAt: new Date(2026, 0, 1, 0, 0, index).toISOString(),
	};
}

async function seedLibrary(page: Page, rows: SceneRow[]): Promise<void> {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await page.evaluate(async (documents) => {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("scenes", "readwrite");
				const store = tx.objectStore("scenes");
				store.clear();
				for (const document of documents) store.put(document);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
		localStorage.removeItem("pedalvision.scenes.v1");
		localStorage.removeItem("pedalvision.settings.v1");
		localStorage.removeItem("pedalvision.scene.v1");
	}, rows);
}

/** Reload and measure wall-clock boot until the scene chrome is on screen. */
async function bootAndMeasure(page: Page): Promise<number> {
	const started = Date.now();
	await page.reload();
	await expect(page.getByTestId("scene-open")).toBeVisible();
	await expect(page.getByTestId("stage")).toBeVisible();
	return Date.now() - started;
}

async function measureHeapMb(page: Page): Promise<number | null> {
	const bytes = await page.evaluate(() => {
		const memory = (
			performance as unknown as { memory?: { usedJSHeapSize: number } }
		).memory;
		return memory?.usedJSHeapSize ?? null;
	});
	return bytes === null ? null : Math.round((bytes / 1024 / 1024) * 10) / 10;
}

/** rAF frames in 1 s, with a wheel-zoom event every frame (the old table metric). */
async function measureFps(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const stage = document.querySelector<HTMLElement>('[data-testid="stage"]');
		const rect = stage?.getBoundingClientRect();
		let frames = 0;
		const started = performance.now();
		await new Promise<void>((resolve) => {
			const tick = () => {
				frames += 1;
				if (stage && rect) {
					stage.dispatchEvent(
						new WheelEvent("wheel", {
							deltaY: -30,
							clientX: rect.left + rect.width / 2,
							clientY: rect.top + rect.height / 2,
							bubbles: true,
							cancelable: true,
						}),
					);
				}
				if (performance.now() - started < 1000) requestAnimationFrame(tick);
				else resolve();
			};
			requestAnimationFrame(tick);
		});
		return frames;
	});
}

function parsePixels(spec: string): { width: number; height: number } {
	const match = spec.match(/([\d,]+)\s*×\s*([\d,]+)/);
	if (!match) throw new Error(`Unreadable export spec: ${spec}`);
	return {
		width: Number(match[1].replaceAll(",", "")),
		height: Number(match[2].replaceAll(",", "")),
	};
}

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

async function exportAllContent(page: Page): Promise<{
	ms: number;
	bytes: number;
	width: number;
	height: number;
	distinctImages: string;
	estimatedSize: string;
	png: boolean;
}> {
	await page.getByTestId("export-open").click();
	await expect(page.getByTestId("export-panel")).toBeVisible();
	const allContent = page.locator('input[name="export-scope"][value="all"]');
	if (!(await allContent.isChecked())) await allContent.check();
	const spec = await page.getByTestId("export-size").innerText();
	const distinctImages = await page.getByTestId("export-images").innerText();
	const estimatedSize = await page.getByTestId("export-file-size").innerText();
	const { width, height } = parsePixels(spec);

	const started = Date.now();
	const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
	await page.getByTestId("export-download").click();
	const download = await downloadPromise;
	const path = await download.path();
	const ms = Date.now() - started;
	const bytes = path ? statSync(path).size : 0;
	const signature = path
		? readFileSync(path).subarray(0, PNG_SIGNATURE.length)
		: Buffer.alloc(0);
	await expect(page.getByTestId("export-done")).toBeVisible();
	await page.getByTestId("export-done").click();

	// Structural facts only — no timing gate (report-only).
	expect(bytes).toBeGreaterThan(0);
	expect(signature.equals(PNG_SIGNATURE)).toBe(true);
	expect(width).toBeLessThanOrEqual(8192);
	expect(height).toBeLessThanOrEqual(8192);
	expect(width * height).toBeLessThanOrEqual(16_777_216);

	return {
		ms,
		bytes,
		width,
		height,
		distinctImages,
		estimatedSize,
		png: true,
	};
}

interface ResultRow {
	scenario: string;
	items: number;
	distinct: string;
	docKb: string;
	bootMs: number;
	heapMb: string;
	fps: number;
	exportMs: string;
	exportMb: string;
	spec: string;
}

function kb(bytes: number): string {
	return (bytes / 1024).toFixed(1);
}

function mb(bytes: number): string {
	return (bytes / 1_000_000).toFixed(2);
}

async function benchmark(
	page: Page,
	name: string,
	rows: SceneRow[],
	active: SceneRow,
): Promise<ResultRow> {
	await seedLibrary(page, rows);
	const bootMs = await bootAndMeasure(page);
	const heapMb = await measureHeapMb(page);
	const fps = await measureFps(page);
	const exported = await exportAllContent(page);
	return {
		scenario: name,
		items: active.items.length,
		distinct: exported.distinctImages,
		docKb: kb(new TextEncoder().encode(JSON.stringify(active)).length),
		bootMs,
		heapMb: heapMb === null ? "n/a" : String(heapMb),
		fps,
		exportMs: String(exported.ms),
		exportMb: mb(exported.bytes),
		spec: `${exported.width}×${exported.height}`,
	};
}

function printTable(results: ResultRow[]): void {
	const header = [
		"Scenario",
		"Items",
		"Distinct",
		"Doc KB",
		"Boot ms",
		"Heap MB",
		"FPS",
		"Export ms",
		"PNG MB",
		"Spec",
	];
	const lines = [
		`| ${header.join(" | ")} |`,
		`| ${header.map(() => "---").join(" | ")} |`,
		...results.map((row) =>
			[
				row.scenario,
				String(row.items),
				row.distinct,
				row.docKb,
				String(row.bootMs),
				row.heapMb,
				String(row.fps),
				row.exportMs,
				row.exportMb,
				row.spec,
			]
				.join(" | ")
				.replace(/^/, "| ")
				.replace(/$/, " |"),
		),
	];
	// Playwright prints test stdout; this table is the benchmark's deliverable.
	console.log(`\nP3-06 capacity benchmark\n\n${lines.join("\n")}\n`);
}

test("capacity benchmark (report-only)", async ({ page }) => {
	const results: ResultRow[] = [];

	const distinct89 = scene(
		"89 distinct pedals · 10 boards",
		89,
		10,
		DISTINCT_PEDALS,
	);
	results.push(
		await benchmark(page, "89 distinct · 10 boards", [distinct89], distinct89),
	);

	for (const count of [50, 100, 200, 400]) {
		const row = scene(`1 board · ${count} items`, count, 1, REPEATED_PEDALS);
		results.push(
			await benchmark(page, `1 board · ${count} items (7 images)`, [row], row),
		);
	}

	const mixed400 = scene(
		"400 items · 89 distinct images",
		400,
		1,
		DISTINCT_PEDALS,
	);
	results.push(
		await benchmark(page, "400 items · 89 distinct", [mixed400], mixed400),
	);

	const tenBoards = scene("10 boards · 400 items", 400, 10, REPEATED_PEDALS);
	results.push(
		await benchmark(
			page,
			"10 boards · 400 items (7 images)",
			[tenBoards],
			tenBoards,
		),
	);

	const tenScenes = Array.from({ length: 10 }, (_, index) =>
		scene(`Scene ${index + 1}`, 100, 1, REPEATED_PEDALS, index),
	);
	results.push(
		await benchmark(page, "10 scenes · 100 items", tenScenes, tenScenes[9]),
	);

	const fiftyScenes = Array.from({ length: 50 }, (_, index) =>
		scene(`Scene ${index + 1}`, 100, 1, REPEATED_PEDALS, index),
	);
	results.push(
		await benchmark(
			page,
			"50 scenes · 100 items",
			fiftyScenes,
			fiftyScenes[49],
		),
	);

	printTable(results);
});
