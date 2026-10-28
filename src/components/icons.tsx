/**
 * Shared inline SVG glyphs (20px default, currentColor). One source for the
 * pedal / board / plus icons used by the toolbar (`App.tsx`) and the picker
 * (`Picker.tsx`) so they can't drift apart.
 */
interface IconProps {
	size?: number;
	strokeWidth?: number;
	className?: string;
}

export function PedalIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<circle cx="9.5" cy="8" r="1.4" />
			<circle cx="14.5" cy="8" r="1.4" />
			<path d="M9.5 13h5" />
		</svg>
	);
}

export function BoardIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="2.5" y="7" width="19" height="10" rx="2" />
			<path d="M6 7v10M18 7v10" opacity="0.5" />
		</svg>
	);
}

/** Four corner brackets — "frame this view" (F-04 viewport focus). */
export function FrameIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 9V5a1 1 0 0 1 1-1h4" />
			<path d="M15 4h4a1 1 0 0 1 1 1v4" />
			<path d="M20 15v4a1 1 0 0 1-1 1h-4" />
			<path d="M9 20H5a1 1 0 0 1-1-1v-4" />
		</svg>
	);
}

export function PlusIcon({
	size = 12,
	strokeWidth = 2.4,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
	);
}

/** "Build your own" — used by the Custom tab (sliders/equalizer glyph). */
export function CustomIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
			<circle cx="15" cy="7" r="2" />
			<circle cx="9" cy="17" r="2" />
		</svg>
	);
}

/** Space-warning triangle (info panel band + canvas context). */
export function WarningIcon({
	size = 16,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 4.5 21 19H3z" />
			<path d="M12 10v4" />
			<path d="M12 16.6v.01" />
		</svg>
	);
}

/** Download / export — the P3-01 toolbar trigger + primary action. */
export function DownloadIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 3v12" />
			<path d="M7.5 10.5 12 15l4.5-4.5" />
			<path d="M4 19h16" />
		</svg>
	);
}

/** Link — the P3-03 share trigger / transmittal link. */
export function LinkIcon({
	size = 18,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.3" />
			<path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3" />
		</svg>
	);
}

/** Copy — the share panel's primary action. */
export function CopyIcon({
	size = 16,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="8" y="8" width="12" height="12" rx="2" />
			<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
		</svg>
	);
}

/** Lock — the read-only "REVIEW COPY" stamp. */
export function LockIcon({ size = 14, strokeWidth = 2, className }: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="5" y="10" width="14" height="10" rx="2" />
			<path d="M8 10V7a4 4 0 0 1 8 0v3" />
		</svg>
	);
}

/** Chevron — the mobile info-sheet expand/collapse affordance. */
export function ChevronIcon({
	size = 18,
	strokeWidth = 2,
	className,
	path = "M6 9l6 6 6-6",
}: IconProps & { path?: string }) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={path} />
		</svg>
	);
}

/** Undo — the "Proof Marks" history pair (P3-04). */
export function UndoIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M9 14 4 9l5-5" />
			<path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
		</svg>
	);
}

/** Redo — the mirrored half of the "Proof Marks" pair (P3-04). */
export function RedoIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M15 14l5-5-5-5" />
			<path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
		</svg>
	);
}

/** Scene / sheet-stack glyph — the always-visible scene plate. */
export function SceneIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M7 4.5h10a2 2 0 0 1 2 2V18" opacity="0.5" />
			<rect x="4" y="6.5" width="12" height="14" rx="2" />
			<path d="M7 11h6M7 14.5h6" />
		</svg>
	);
}

export function PencilIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
			<path d="M13.5 6.5l4 4" />
		</svg>
	);
}

export function TrashIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 7h16" />
			<path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
			<path d="M6.5 7l1 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12" />
			<path d="M10 11v6M14 11v6" opacity="0.6" />
		</svg>
	);
}

export function CheckIcon({
	size = 18,
	strokeWidth = 2,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M5 12.5l4.5 4.5L19 7" />
		</svg>
	);
}

export function CloseIcon({
	size = 18,
	strokeWidth = 2,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M6 6l12 12M18 6 6 18" />
		</svg>
	);
}

/** Sun glyph for the light-theme toggle (mobile icon-only). */
export function SunIcon({
	size = 18,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
		</svg>
	);
}

/** Moon glyph for the dark-theme toggle (mobile icon-only). */
export function MoonIcon({
	size = 18,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
		</svg>
	);
}

export function RulerIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M3.5 16.5 16.5 3.5l4 4L7.5 20.5z" />
			<path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
		</svg>
	);
}
