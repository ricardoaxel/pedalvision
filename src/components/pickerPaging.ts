export const PICKER_PAGE = 300;

export function visibleCountFor(
	key: string,
	state: { key: string; count: number },
): number {
	return state.key === key ? state.count : PICKER_PAGE;
}

export function nextPageCount(count: number): number {
	return count + PICKER_PAGE;
}
