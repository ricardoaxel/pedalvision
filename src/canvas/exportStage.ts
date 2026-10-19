import Konva from "konva";
import { resolveImageUrl } from "../lib/cdn";
import {
	cableEndPointCm,
	EXPORT_PADDING_CM,
	ExportError,
	type ExportFormat,
	type ExportPlan,
	SCALE_BAR_LONG_CM,
	SCALE_BAR_SHORT_BELOW_CM,
	SCALE_BAR_SHORT_CM,
} from "../lib/exportScene";
import { buildPdfFromJpeg } from "../lib/pdf";
import {
	boardDefinition,
	boardFootprint,
	isCustomBoard,
	itemsByZ,
	type PlacedBoard,
	resolveItem,
} from "../state/scene";
import {
	CANVAS_FONTS,
	type CanvasTheme,
	ITEM_LABEL,
	lightCanvasTheme,
} from "../styles/theme";
import { finishBaseColor, finishPatternTile } from "./boardFinish";
import { loadImageWithHeal } from "./loadImage";

/**
 * Detached offscreen export renderer for P3-01 (design.md §Canvas architecture →
 * Export).
 *
 * The live stage is never rasterized: its zoom/pan and viewport-sized canvas
 * would clip off-screen content. This builds a separate Konva Stage sized to the
 * export bounds, draws from the scene document at true scale, fills an opaque
 * surface background, and then rasterizes at the iOS-safe ratio.
 *
 * PNG follows the app theme. PDF is print-oriented and always uses the light
 * "paper" palette, then wraps the same raster in a true-scale single-page PDF.
 */

export type ExportFileResult =
	| {
			format: "png";
			dataUrl: string;
			widthPx: number;
			heightPx: number;
	  }
	| {
			format: "pdf";
			bytes: Uint8Array;
			widthPx: number;
			heightPx: number;
	  };

interface RenderContext {
	plan: ExportPlan;
	theme: CanvasTheme;
	/** Output pixels per local (export-stage) pixel (fitScale × pixelRatio). */
	unit: number;
	/** Label/text sizing unit — doubled in HD so print text stays legible. */
	labelUnit: number;
	/** Stage pixels per centimetre for this quality (32 standard / 64 HD). */
	pxPerCm: number;
	images: Map<string, HTMLImageElement>;
}

interface ImageRequest {
	key: string;
	src: string;
	name: string;
}

function imageRequests(plan: ExportPlan): ImageRequest[] {
	const requests: ImageRequest[] = [];
	for (const board of plan.boards) {
		const definition = boardDefinition(board);
		if (!definition) continue;
		requests.push({
			key: `b:${board.uid}`,
			src: resolveImageUrl(
				definition.imageSource,
				definition.image,
				"board",
				800,
			),
			name: `${definition.brand} ${definition.name}`,
		});
	}
	for (const item of plan.items) {
		const resolved = resolveItem(item, plan.customPedals);
		if (!resolved.definition) continue;
		requests.push({
			key: `i:${item.uid}`,
			src: resolveImageUrl(
				resolved.definition.imageSource,
				resolved.definition.image,
				"pedal",
				800,
			),
			name: resolved.name,
		});
	}
	return requests;
}

async function preloadImages(
	plan: ExportPlan,
): Promise<Map<string, HTMLImageElement>> {
	const requests = imageRequests(plan);
	const images = new Map<string, HTMLImageElement>();
	const failures: string[] = [];

	await Promise.all(
		requests.map(async (request) => {
			try {
				images.set(request.key, await loadImageWithHeal(request.src));
			} catch {
				failures.push(request.name);
			}
		}),
	);

	if (failures.length > 0) {
		const names = [...new Set(failures)];
		throw new ExportError(
			"image",
			`${names.length === 1 ? "This image" : "These images"} couldn't be loaded: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}.`,
			names,
		);
	}

	return images;
}

function labelChip(
	parent: Konva.Group,
	context: RenderContext,
	options: {
		width: number;
		height: number;
		text: string;
		opacity: number;
		monoPrefix?: string;
	},
): void {
	const { labelUnit: unit, theme } = context;
	const inset = ITEM_LABEL.insetPx / unit;
	const pad = 3 / unit;
	const chipHeight = Math.max(
		0,
		Math.min(ITEM_LABEL.heightPx / unit, options.height - inset * 2),
	);
	const chipWidth = Math.max(0, options.width - inset * 2);
	if (chipHeight <= 0 || chipWidth <= 0) return;

	const y = options.height - inset - chipHeight;
	parent.add(
		new Konva.Rect({
			x: inset,
			y,
			width: chipWidth,
			height: chipHeight,
			fill: theme.itemLabelBg,
			cornerRadius: Math.min(chipHeight / 2, 3 / unit),
			listening: false,
		}),
	);

	const prefix = options.monoPrefix ?? "";
	const prefixWidth = prefix
		? Math.min(chipWidth * 0.42, (ITEM_LABEL.fontSizePx * 0.72 * 4.6) / unit)
		: 0;
	if (prefix) {
		parent.add(
			new Konva.Text({
				text: prefix,
				x: inset + pad,
				y,
				height: chipHeight,
				verticalAlign: "middle",
				fontFamily: CANVAS_FONTS.mono,
				fontSize: (ITEM_LABEL.fontSizePx * 0.72) / unit,
				letterSpacing: 0.5 / unit,
				fill: theme.itemLabelInk,
				wrap: "none",
				listening: false,
			}),
		);
	}

	parent.add(
		new Konva.Text({
			text: options.text,
			x: inset + pad + prefixWidth,
			y,
			width: Math.max(0, chipWidth - pad * 2 - prefixWidth),
			height: chipHeight,
			verticalAlign: "middle",
			fontFamily: CANVAS_FONTS.sans,
			fontSize: ITEM_LABEL.fontSizePx / unit,
			fill: theme.itemLabelInk,
			wrap: "none",
			ellipsis: true,
			opacity: options.opacity,
			listening: false,
		}),
	);
}

function drawBoardFallback(
	parent: Konva.Group,
	context: RenderContext,
	label: string,
	dims: string,
	width: number,
	height: number,
): void {
	const { theme, unit } = context;
	parent.add(
		new Konva.Rect({
			width,
			height,
			fill: theme.boardDraftFill,
			stroke: theme.boardStroke,
			strokeWidth: 1 / unit,
			dash: [4 / unit, 3 / unit],
			cornerRadius: 2 / unit,
			listening: false,
		}),
	);
	const showName = height * unit >= 40 && width * unit >= 72;
	const showDims = height * unit >= 32;
	const pad = Math.min(6 / unit, width * 0.1);
	const textWidth = Math.max(0, width - pad * 2);
	if (showName) {
		parent.add(
			new Konva.Text({
				text: label,
				x: pad,
				width: textWidth,
				y: height / 2 - 15 / unit,
				align: "center",
				fontFamily: CANVAS_FONTS.sans,
				fontSize: 10 / unit,
				fill: theme.boardLabel,
				wrap: "none",
				ellipsis: true,
				listening: false,
			}),
		);
	}
	if (showDims) {
		parent.add(
			new Konva.Text({
				text: dims,
				x: pad,
				width: textWidth,
				y: showName ? height / 2 - 1 / unit : height / 2 - 6 / unit,
				align: "center",
				fontFamily: CANVAS_FONTS.mono,
				fontSize: 10 / unit,
				fill: theme.boardLabel,
				wrap: "none",
				ellipsis: true,
				listening: false,
			}),
		);
	}
}

function drawCustomBoard(
	parent: Konva.Group,
	context: RenderContext,
	board: PlacedBoard,
	width: number,
	height: number,
): void {
	const { theme, unit, pxPerCm } = context;
	const notch = Math.min(Math.min(width, height) * 0.18, 0.9 * pxPerCm);
	const finish = board.texture ?? "matte";
	const pattern = finishPatternTile(finish, theme);
	parent.add(
		new Konva.Line({
			points: [0, 0, width - notch, 0, width, notch, width, height, 0, height],
			closed: true,
			fill: finishBaseColor(finish, theme),
			fillPatternImage: pattern ?? undefined,
			fillPriority: pattern ? "pattern" : "color",
			stroke: theme.customStroke,
			strokeWidth: 1 / unit,
			lineJoin: "round",
			listening: false,
		}),
	);
	parent.add(
		new Konva.Line({
			points: [width - notch, 0, width, notch],
			stroke: theme.customStroke,
			strokeWidth: 1 / unit,
			opacity: 0.5,
			listening: false,
		}),
	);

	const name = board.name?.trim() || "Custom board";
	const screenWidth = width * unit;
	if (screenWidth >= ITEM_LABEL.minWidthPx) {
		labelChip(parent, context, {
			width,
			height,
			text: name,
			opacity: 1,
			monoPrefix: "CUSTOM",
		});
	}
}

function drawItem(
	parent: Konva.Group,
	context: RenderContext,
	item: (typeof context.plan.items)[number],
): void {
	const { plan, theme, unit, labelUnit, pxPerCm } = context;
	const resolved = resolveItem(item, plan.customPedals);
	const width = resolved.widthCm * pxPerCm;
	const height = resolved.heightCm * pxPerCm;
	const group = new Konva.Group({
		x: item.x * pxPerCm,
		y: item.y * pxPerCm,
		rotation: item.rotationDeg,
		listening: false,
	});
	parent.add(group);

	const screenWidth = width * unit;
	const screenHeight = height * unit;
	const custom = resolved.custom !== null;

	if (custom) {
		group.add(
			new Konva.Rect({
				width,
				height,
				fill: theme.customFill,
				stroke: theme.customStroke,
				strokeWidth: 1 / unit,
				cornerRadius: [0, Math.min(width, height) * 0.22, 0, 0],
				listening: false,
			}),
		);
		if (screenWidth >= 20 && screenHeight >= 16) {
			group.add(
				new Konva.Text({
					text: "CUSTOM",
					x: ITEM_LABEL.insetPx / labelUnit,
					y: ITEM_LABEL.insetPx / labelUnit,
					width: Math.max(0, width - (ITEM_LABEL.insetPx * 2) / labelUnit),
					align: "center",
					fontFamily: CANVAS_FONTS.mono,
					fontSize: (ITEM_LABEL.fontSizePx * 0.6) / labelUnit,
					letterSpacing: 0.5 / labelUnit,
					fill: theme.itemLabelInk,
					wrap: "none",
					ellipsis: true,
					listening: false,
				}),
			);
		}
	} else {
		const image = context.images.get(`i:${item.uid}`);
		if (image) {
			group.add(
				new Konva.Image({
					image,
					width,
					height,
					listening: false,
				}),
			);
		} else {
			const pad = Math.min(4 / labelUnit, width * 0.08);
			group.add(
				new Konva.Rect({
					width,
					height,
					fill: theme.boardDraftFill,
					stroke: theme.boardStroke,
					strokeWidth: 1 / unit,
					dash: [3 / unit, 2 / unit],
					cornerRadius: 2 / unit,
					listening: false,
				}),
			);
			if (screenHeight >= 26 && screenWidth >= 30) {
				group.add(
					new Konva.Text({
						text: resolved.name,
						x: pad,
						width: Math.max(0, width - pad * 2),
						y: height / 2 - 6 / labelUnit,
						align: "center",
						fontFamily: CANVAS_FONTS.sans,
						fontSize: 9 / labelUnit,
						fill: theme.boardLabel,
						wrap: "none",
						ellipsis: true,
						listening: false,
					}),
				);
			}
		}
	}

	const showLabel = custom || screenWidth >= ITEM_LABEL.minWidthPx;
	if (showLabel) {
		labelChip(group, context, {
			width,
			height,
			text: resolved.name,
			opacity:
				custom || screenWidth >= ITEM_LABEL.fullOpacityWidthPx
					? 1
					: ITEM_LABEL.opacity,
		});
	}
}

function drawCables(parent: Konva.Group, context: RenderContext): void {
	const { plan, theme, unit, labelUnit, pxPerCm } = context;
	for (const cable of plan.cables) {
		const from = cableEndPointCm(cable.from, plan);
		const to = cableEndPointCm(cable.to, plan);
		if (!from || !to) continue;
		parent.add(
			new Konva.Arrow({
				points: [
					from.x * pxPerCm,
					from.y * pxPerCm,
					to.x * pxPerCm,
					to.y * pxPerCm,
				],
				stroke: cable.color ?? theme.cable,
				fill: cable.color ?? theme.cable,
				strokeWidth: 2 / unit,
				pointerLength: 8 / unit,
				pointerWidth: 6 / unit,
				lineCap: "round",
				listening: false,
			}),
		);
	}

	for (const endpoint of plan.endpoints) {
		const x = endpoint.x * pxPerCm;
		const y = endpoint.y * pxPerCm;
		parent.add(
			new Konva.Circle({
				x,
				y,
				radius: 4 / unit,
				fill: theme.canvasBackground,
				stroke: theme.cable,
				strokeWidth: 1.5 / unit,
				listening: false,
			}),
		);
		parent.add(
			new Konva.Text({
				text: endpoint.kind === "amp" ? "AMP" : "IN",
				x: x + 7 / labelUnit,
				y: y - 5 / labelUnit,
				fontFamily: CANVAS_FONTS.mono,
				fontSize: 9 / labelUnit,
				fill: theme.boardLabel,
				listening: false,
			}),
		);
	}
}

function drawScaleBar(parent: Konva.Group, context: RenderContext): void {
	const { plan, theme, labelUnit, pxPerCm } = context;
	const contentWidth = plan.contentBoundsCm.widthCm;
	const lengthCm =
		contentWidth >= SCALE_BAR_SHORT_BELOW_CM
			? SCALE_BAR_LONG_CM
			: SCALE_BAR_SHORT_CM;
	const startX = plan.contentBoundsCm.x * pxPerCm;
	const y =
		(plan.contentBoundsCm.y + plan.contentBoundsCm.heightCm) * pxPerCm +
		(EXPORT_PADDING_CM / 2) * pxPerCm;
	const endX = startX + lengthCm * pxPerCm;
	const tick = 4 / labelUnit;
	const strokeWidth = 1 / labelUnit;

	parent.add(
		new Konva.Line({
			points: [startX, y, endX, y],
			stroke: theme.boardLabel,
			strokeWidth,
			listening: false,
		}),
	);
	parent.add(
		new Konva.Line({
			points: [startX, y - tick, startX, y + tick],
			stroke: theme.boardLabel,
			strokeWidth,
			listening: false,
		}),
	);
	parent.add(
		new Konva.Line({
			points: [endX, y - tick, endX, y + tick],
			stroke: theme.boardLabel,
			strokeWidth,
			listening: false,
		}),
	);
	parent.add(
		new Konva.Text({
			text: `${lengthCm} cm`,
			x: endX + 6 / labelUnit,
			y: y - 5.5 / labelUnit,
			fontFamily: CANVAS_FONTS.mono,
			fontSize: 11 / labelUnit,
			fill: theme.boardLabel,
			listening: false,
		}),
	);
}

function dataUrlBytes(dataUrl: string): Uint8Array {
	const separator = dataUrl.indexOf(",");
	if (separator === -1) throw new Error("invalid data URL");
	const binary = atob(dataUrl.slice(separator + 1));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

/**
 * Render the plan to a PNG or a true-scale PDF. Throws {@link ExportError} with
 * a user-facing code when the scene is empty, images can't be loaded
 * CORS-cleanly, or the canvas is tainted.
 */
export async function renderExportFile(
	plan: ExportPlan,
	theme: CanvasTheme,
	format: ExportFormat,
): Promise<ExportFileResult> {
	const images = await preloadImages(plan);
	const container = document.createElement("div");
	const stage = new Konva.Stage({
		container,
		width: plan.stageWidthPx,
		height: plan.stageHeightPx,
	});
	const layer = new Konva.Layer({ listening: false });
	// The detached layer must not allocate a DPR-sized scene canvas: the stage is
	// already sized to the export budget, and toDataURL re-renders at the explicit
	// pixelRatio below. Without this, a 2–3× phone allocates 4–9× the budget.
	layer.getCanvas().setPixelRatio(1);
	stage.add(layer);

	// PDF is the print artifact: a dark background would print heavy, so the
	// paper-light palette is used regardless of the app theme. PNG stays WYSIWYG.
	const renderTheme = format === "pdf" ? lightCanvasTheme : theme;
	const unit = plan.fitScale * plan.pixelRatio;
	const context: RenderContext = {
		plan,
		theme: renderTheme,
		unit,
		labelUnit: plan.quality === "hd" ? unit / 2 : unit,
		pxPerCm: plan.pxPerCm,
		images,
	};

	try {
		layer.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: plan.stageWidthPx,
				height: plan.stageHeightPx,
				fill: renderTheme.canvasBackground,
				listening: false,
			}),
		);

		const content = new Konva.Group({
			x: -plan.boundsCm.x * plan.pxPerCm * plan.fitScale,
			y: -plan.boundsCm.y * plan.pxPerCm * plan.fitScale,
			scaleX: plan.fitScale,
			scaleY: plan.fitScale,
			listening: false,
		});
		layer.add(content);

		for (const board of plan.boards) {
			const footprint = boardFootprint(board);
			const boardGroup = new Konva.Group({
				x: board.x * plan.pxPerCm,
				y: board.y * plan.pxPerCm,
				rotation: board.rotationDeg,
				listening: false,
			});
			content.add(boardGroup);
			const width = footprint.widthCm * plan.pxPerCm;
			const height = footprint.heightCm * plan.pxPerCm;

			if (isCustomBoard(board)) {
				drawCustomBoard(boardGroup, context, board, width, height);
			} else {
				const definition = boardDefinition(board);
				const image = images.get(`b:${board.uid}`);
				if (image) {
					boardGroup.add(
						new Konva.Image({
							image,
							width,
							height,
							listening: false,
						}),
					);
				} else {
					drawBoardFallback(
						boardGroup,
						context,
						definition ? `${definition.brand} ${definition.name}` : "Board",
						`${footprint.widthCm} × ${footprint.heightCm} cm`,
						width,
						height,
					);
				}
			}

			for (const item of itemsByZ(
				plan.items.filter((candidate) => candidate.boardUid === board.uid),
			)) {
				drawItem(boardGroup, context, item);
			}
		}

		for (const item of itemsByZ(
			plan.items.filter((candidate) => candidate.boardUid === null),
		)) {
			drawItem(content, context, item);
		}

		drawCables(content, context);
		drawScaleBar(content, context);
		layer.draw();

		let raster: string;
		try {
			raster = stage.toDataURL({
				pixelRatio: plan.pixelRatio,
				mimeType: format === "pdf" ? "image/jpeg" : "image/png",
				quality: format === "pdf" ? 0.92 : undefined,
			});
		} catch (error) {
			const tainted =
				error instanceof DOMException && error.name === "SecurityError";
			throw new ExportError(
				tainted ? "tainted" : "unknown",
				tainted
					? "An image blocked the export. Try again."
					: "The export didn't finish. Try again.",
			);
		}

		if (format === "pdf") {
			if (!raster.startsWith("data:image/jpeg")) {
				throw new ExportError(
					"unknown",
					"The PDF encoder didn't finish. Try again.",
				);
			}
			const bytes = buildPdfFromJpeg({
				jpeg: dataUrlBytes(raster),
				widthPx: plan.outputWidthPx,
				heightPx: plan.outputHeightPx,
				widthCm: plan.boundsCm.widthCm,
				heightCm: plan.boundsCm.heightCm,
			});
			return {
				format: "pdf",
				bytes,
				widthPx: plan.outputWidthPx,
				heightPx: plan.outputHeightPx,
			};
		}

		return {
			format: "png",
			dataUrl: raster,
			widthPx: plan.outputWidthPx,
			heightPx: plan.outputHeightPx,
		};
	} finally {
		stage.destroy();
	}
}
