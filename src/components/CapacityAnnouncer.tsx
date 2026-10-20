import { useEffect, useMemo, useRef, useState } from "react";
import { capacityStatus } from "../lib/capacity";
import { useScene } from "../state/scene";

/**
 * A single visually-hidden polite announcer for capacity **state transitions**
 * (P3-06 "Load Chart"). Visible capacity lines are plain text read through
 * `aria-describedby`; making them live would announce every placement. This
 * announces only ok→soft, soft→hard and an over-cap scene on load.
 */
export function CapacityAnnouncer() {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const status = useMemo(
		() => capacityStatus({ boards, items, customPedals }),
		[boards, items, customPedals],
	);
	const over =
		status.items.over ||
		status.images.over ||
		status.boards.over ||
		status.graph.over;
	const key = [
		status.level,
		status.items.level,
		status.images.level,
		status.boards.level,
		status.graph.level,
		over ? "over" : "within",
	].join(":");
	const previous = useRef<string | null>(null);
	const [message, setMessage] = useState("");

	useEffect(() => {
		// Count changes keep the same key. Never speak for a count-only change:
		// only an ok→soft / soft→hard / hard→over transition is announced.
		if (previous.current === key) return;
		const first = previous.current === null;
		previous.current = key;
		if (status.level === "ok") {
			setMessage("");
			return;
		}
		// The initial mount is the "scene loaded" case: announce an over-cap
		// recovered/shared scene once, but stay quiet for a merely tight one.
		if (first && !over) return;
		setMessage(status.warning ?? "");
	}, [key, over, status.level, status.warning]);

	return (
		<p
			className="visually-hidden"
			aria-live="polite"
			aria-atomic="true"
			data-testid="capacity-announcer"
		>
			{message}
		</p>
	);
}
