import { useEffect, useState } from "react";
import {
	type CanvasTheme,
	canvasTheme,
	lightCanvasTheme,
} from "../styles/theme";

function readTheme(): CanvasTheme {
	if (typeof document === "undefined") return canvasTheme;
	return document.documentElement.dataset.theme === "light"
		? lightCanvasTheme
		: canvasTheme;
}

/**
 * Konva can't read CSS variables, so the canvas reads the mirrored JS theme
 * map (design.md §Theming, N1). This hook follows the `data-theme` attribute
 * on `<html>` (the same switch the DOM chrome uses) and re-renders the canvas
 * when it flips.
 */
export function useCanvasTheme(): CanvasTheme {
	const [theme, setTheme] = useState<CanvasTheme>(readTheme);

	useEffect(() => {
		const observer = new MutationObserver(() => setTheme(readTheme()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		return () => observer.disconnect();
	}, []);

	return theme;
}
