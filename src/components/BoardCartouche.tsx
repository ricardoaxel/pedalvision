import type { BoardReadout } from "../lib/boardInfo";
import { resolveThumbImageUrl } from "../lib/cdn";
import { BoardIcon } from "./icons";
import { usePartImage } from "./partImage";

/**
 * The mobile "Title Block" strip's content (F-06). Passive: the thumbnail is
 * decorative and the identity is text, so the strip never steals a canvas
 * gesture. The wrapper owns positioning (above the board action bar in edit
 * mode, pinned above the safe area in a read-only share, which has no bar).
 */
export function BoardCartoucheContent({
	readout,
	dimensions,
}: {
	readout: BoardReadout;
	dimensions: string;
}) {
	const thumbSrc = readout.image
		? resolveThumbImageUrl(readout.image.source, readout.image.value, "board")
		: "";
	const thumb = usePartImage(thumbSrc);
	const showThumb = readout.image !== null && thumb.phase !== "failed";
	const kindShort = readout.kind === "catalog" ? "Catalog" : "Custom";
	const subline = [readout.brand, kindShort, readout.finish]
		.filter(Boolean)
		.join(" · ");

	return (
		<>
			<span className="board-cartouche__thumb" aria-hidden="true">
				{readout.texture ? (
					<span
						className={`board-cartouche__finish finish-swatch__tile finish-swatch__tile--${readout.texture}`}
					/>
				) : showThumb ? (
					<img
						key={`${thumbSrc}:${thumb.phase}`}
						src={thumb.url}
						alt=""
						loading="lazy"
						crossOrigin={thumb.crossOrigin}
						onError={thumb.onError}
					/>
				) : (
					<BoardIcon size={18} strokeWidth={1.4} />
				)}
			</span>
			<span className="board-cartouche__identity">
				<span className="board-cartouche__name">{readout.name}</span>
				<span className="board-cartouche__subline">{subline}</span>
			</span>
			<span className="board-cartouche__dims">{dimensions}</span>
		</>
	);
}
