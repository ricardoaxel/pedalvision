/**
 * Catalog launch caps (P5-01). Recorded here so the plan, inventory and P5-02
 * tooling share one source of truth. Enforcement lives in P5-02/P5-03.
 *
 * Owner decision 2026-10-21: 2,000 hosted pedals max until P5-05; boards have a
 * separate image budget and do not count toward the pedal cap. Owner waiver
 * 2026-10-29 (ADR-009): the non-commercial planner fill may exceed the cap;
 * commercial launch still requires replacement/cleanup.
 */
export const CATALOG_LIMITS = {
	/** Hard cap: pedals with hosted images (runtime + raw candidates). */
	hostedPedals: 9000,
	/** ~2 renditions per hosted pedal (800 + 350). */
	hostedPedalImageFiles: 18000,
	/** Approximate image budget for 2,000 hosted pedals. */
	hostedPedalImageMb: 1200,
	/** First launch batch: ~1,850 pedals + exactly 150 boards. */
	firstBatchItems: 2000,
	tierAPedals: 1850,
	/** Exactly 150 Tier A boards, in priority-brand order. */
	tierABoards: 150,
	/** Board image budget: ~2 renditions per Tier A board. */
	boardImageFiles: 300,
	boardImageMb: 20,
	/** Absolute minimum launch bar (ADR-003): below this, launch needs owner sign-off. */
	minLaunchPedals: 200,
	minLaunchBrands: 10,
	minLaunchBoards: 10,
} as const;

/** Brands that supply most of the Tier A pedals, in priority order (P5 plan). */
export const TIER_A_PEDAL_BRANDS = [
	"BOSS",
	"Electro-Harmonix",
	"JHS",
	"MXR",
	"TC Electronic",
	"Behringer",
	"Keeley",
	"Walrus Audio",
	"EarthQuaker",
	"Mooer",
	"Joyo",
	"Strymon",
	"Wampler",
	"Dunlop",
	"Fender",
	"DigiTech",
	"Catalinbread",
	"OBNE",
	"GFI",
	"Meris",
	"Red Panda",
] as const;

/** Board brands in Tier A priority order (P5 plan). */
export const TIER_A_BOARD_BRANDS = [
	"Pedaltrain",
	"Pivotal",
	"Temple Audio",
	"Creation Music",
	"GigRig",
	"Morton",
	"Rockboard",
	"Vertex",
	"Mono",
	"STRICH",
	"Aclam",
	"Friedman",
	"Gator",
	"BOSS",
	"D'Addario",
	"Voodoo Lab",
	"Fender",
	"Blackbird",
	"Harley Benton",
	"Palmer",
	"Fame",
	"SKB",
	"Holeyboard",
] as const;
