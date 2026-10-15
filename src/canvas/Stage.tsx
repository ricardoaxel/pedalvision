import { useEffect, useRef, useState } from "react";
import { Stage as KonvaStage } from "react-konva";
import { useViewport } from "../state/viewport";
import { GridLayer } from "./GridLayer";
import { useCanvasTheme } from "./useCanvasTheme";
import { useViewportGestures } from "./useViewportGestures";

interface Size {
	width: number;
	height: number;
}

/**
 * The canvas host: a Konva `Stage` that fills its container and owns the
 * viewport (pan/zoom) as a stage transform (design.md §Canvas architecture).
 *
 * Sizing is driven by a ResizeObserver — Konva doesn't resize its stage on its
 * own (ADR-001 risk 4). The stage transform comes straight from the viewport
 * store; world positions never depend on the container size, so a resize can't
 * move anything (A1).
 */
export function Stage() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });

	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const y = useViewport((state) => state.y);
	const theme = useCanvasTheme();

	useViewportGestures(containerRef);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (!rect) return;
			setSize({
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			});
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={containerRef}
			className="stage"
			data-testid="stage"
			data-scale={scale}
			data-x={x}
			data-y={y}
		>
			{size.width > 0 && size.height > 0 ? (
				<KonvaStage
					width={size.width}
					height={size.height}
					x={x}
					y={y}
					scaleX={scale}
					scaleY={scale}
				>
					<GridLayer
						color={theme.gridDot}
						width={size.width}
						height={size.height}
						scale={scale}
						x={x}
						y={y}
					/>
				</KonvaStage>
			) : null}
		</div>
	);
}
