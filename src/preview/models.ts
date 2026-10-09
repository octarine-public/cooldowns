import { ETeamState } from "../enum"
import { PreviewHero } from "./heroes"

/** The rows of the preview's unit picker, in the order the dropdown declares them. */
export const enum EPreviewUnit {
	Hero,
	SpiritBear,
	Courier,
	Roshan,
	Familiar,
	Panda,
	Creep
}

/**
 * One row of that picker as the stage needs it: the unit the row stands, by the name the game's
 * own data knows it under, and the model that data named the day this was written.
 *
 * Both, because the two answer at different times. The name is the truthful one — a unit that is
 * given a new model is shown in it without anyone here noticing — but the data behind it is
 * loaded when the script joins a server, and the menu is read in the dashboard as often as in a
 * match. The path is what the card shows until then.
 */
interface PreviewUnitModel {
	readonly unit: string
	readonly model: string
}

/**
 * The unit each row shows. The hero row is whichever hero the card is dressed for — the page
 * hands it in — so its entry here is only what stands until one is chosen.
 *
 * The summons are named at their first level: every later one includes its keys from that one,
 * so the model is the same whichever is picked.
 */
const UNITS: readonly PreviewUnitModel[] = [
	{
		unit: "npc_dota_hero_void_spirit",
		model: "models/heroes/void_spirit/void_spirit.vmdl"
	},
	{
		unit: "npc_dota_lone_druid_bear1",
		model: "models/heroes/lone_druid/spirit_bear.vmdl"
	},
	{
		unit: "npc_dota_courier",
		model: "models/props_gameplay/donkey.vmdl"
	},
	{
		unit: "npc_dota_roshan",
		model: "models/creeps/roshan/roshan.vmdl"
	},
	{
		unit: "npc_dota_visage_familiar1",
		model: "models/heroes/visage/visage_familiar.vmdl"
	},
	{
		unit: "npc_dota_brewmaster_earth_1",
		model: "models/heroes/brewmaster/brewmaster_earthspirit.vmdl"
	},
	{
		unit: "npc_dota_creep_badguys_melee",
		model: "models/creeps/lane_creeps/creep_bad_melee/creep_bad_melee.vmdl"
	}
]

/**
 * The lane creep of the other side, which the last row shows while the card is dressed for a
 * friendly unit. It is the one subject here whose look IS the side it fights for: everything
 * else — a courier, a bear, Roshan — is the same body whoever it belongs to, and swapping it
 * with the team picker would say something about the game that is not true.
 */
const RADIANT_CREEP: PreviewUnitModel = {
	unit: "npc_dota_creep_goodguys_melee",
	model: "models/creeps/lane_creeps/creep_radiant_melee/radiant_melee.vmdl"
}

/**
 * Which of its drawings the game puts over a unit (CDOTAHealthBars::Render_Internal), as far as
 * the card stands one of them.
 */
export const enum EBarStyle {
	/** A hero's: the sprite frame, the portrait left of it and the level box right of it. */
	Hero,
	/** A courier's, cut into the hits it takes, with its owner's portrait beside it. */
	Pips,
	/** A lane creep's: a thin row in a black frame. */
	Creep,
	/** Roshan's: long and thin, shaded down its height. */
	Large,
	/** A summon's: a hero's rows in a frame of their own, with no portrait and no level. */
	Summon
}

/** A unit's bar as the card needs it, in 1080p pixels. */
export interface PreviewBar {
	readonly style: EBarStyle
	/**
	 * The rectangle the SDK hands the script for the unit's bar (`Unit.HealthBarSize`), which is
	 * what the strips are laid out against - so the card lays them out against the same one.
	 */
	readonly width: number
	readonly height: number
	/** What takes the point the game anchors the bar at to that rectangle's corner. */
	readonly correctionX: number
	readonly correctionY: number
	/** Whether the unit has mana, which a hero-like bar shows a row of. */
	readonly mana: boolean
	/** The health a summon's dividers are counted in, one every 250 of it. */
	readonly maxHealth: number
	/**
	 * Where a hero-like bar's health row is drawn from the anchor, where that is not the SDK's
	 * rectangle: the bear is drawn as a hero is, while the SDK sizes it as a unit of its own.
	 */
	readonly row?: { readonly x: number; readonly y: number; readonly width: number }
	/** Whether it is your own hero's, which the game tints apart from every other. */
	readonly self?: boolean
}

function bar(
	style: EBarStyle,
	width: number,
	height: number,
	correctionX: number,
	correctionY: number,
	mana = false,
	maxHealth = 0,
	row?: PreviewBar["row"]
): PreviewBar {
	return { style, width, height, correctionX, correctionY, mana, maxHealth, row }
}

/** The hero's, by side: wider over your own, and standing a little higher over a friend's. */
const HERO_BARS: Record<ETeamState, PreviewBar> = {
	[ETeamState.Enemy]: bar(EBarStyle.Hero, 99, 8, 99 / 1.98, 31, true),
	[ETeamState.Ally]: bar(EBarStyle.Hero, 99, 8, 99 / 1.98, 32, true),
	[ETeamState.Local]: {
		...bar(EBarStyle.Hero, 107, 8, 107 / 1.98, 37, true),
		self: true
	}
}
/** The hero's row the bear is drawn with, out of `Unit.GetHeroHealthBar`. */
const BEAR_ROW = { x: 50, y: 31, width: 99 }
const BEAR_ENEMY = bar(EBarStyle.Hero, 100, 8, 50, 30, true, 0, BEAR_ROW)
const BEAR_FRIEND = bar(EBarStyle.Hero, 100, 6, 50, 30, true, 0, BEAR_ROW)
/** Two hits a side: the courier's six health at three a hit (`PipBarLayout(2)`). */
const COURIER = bar(EBarStyle.Pips, 30, 7, 15, 6, false, 6)
const ROSHAN = bar(EBarStyle.Large, 225, 5, 112.5, 9)
const FAMILIAR_ENEMY = bar(EBarStyle.Summon, 100, 8, 50, 23, false, 500)
const FAMILIAR_FRIEND = bar(EBarStyle.Summon, 100, 8, 50, 24, false, 500)
const PANDA = bar(EBarStyle.Summon, 100, 8, 50, 23, true, 1400)
const CREEP = bar(EBarStyle.Creep, 80, 5, 40, 11)

/** The bar the game draws over a row of the picker, for the side the card is showing. */
export function PreviewBarOf(unit: number, team: ETeamState): PreviewBar {
	const enemy = team === ETeamState.Enemy
	switch (unit) {
		case EPreviewUnit.SpiritBear:
			return enemy ? BEAR_ENEMY : BEAR_FRIEND
		case EPreviewUnit.Courier:
			return COURIER
		case EPreviewUnit.Roshan:
			return ROSHAN
		case EPreviewUnit.Familiar:
			return enemy ? FAMILIAR_ENEMY : FAMILIAR_FRIEND
		case EPreviewUnit.Panda:
			return PANDA
		case EPreviewUnit.Creep:
			return CREEP
		default:
			return HERO_BARS[team] ?? HERO_BARS[ETeamState.Enemy]
	}
}

/** What a unit that wears nothing wears, handed out rather than minted every frame. */
const EMPTY: readonly string[] = []

/** Which row of the picker a unit index stands, dressed for the side the card is showing. */
function entryOf(unit: number, team: ETeamState): Nullable<PreviewUnitModel> {
	return unit === EPreviewUnit.Creep && team !== ETeamState.Enemy
		? RADIANT_CREEP
		: UNITS[unit]
}

/** The model the stage stands for a row of the picker, dressed for the side it is showing. */
export function PreviewModel(
	unit: number,
	team: ETeamState,
	hero: PreviewHero
): Nullable<string> {
	if (unit === EPreviewUnit.Hero) {
		return hero.model
	}
	const entry = entryOf(unit, team)
	if (entry === undefined) {
		return undefined
	}
	const named = UnitData.GetUnitDataByName(entry.unit)?.ModelName
	return named !== undefined && named !== "" ? named : entry.model
}

/**
 * What that unit wears on top of it, worn on its skeleton rather than hung off it: a Dota
 * wearable is skinned to the hero's own rig and carries none of his animations, so the pose that
 * drives it is his. Everything but a hero is one whole model and wears nothing.
 */
export function PreviewWearables(
	unit: number,
	team: ETeamState,
	hero: PreviewHero
): readonly string[] {
	return unit === EPreviewUnit.Hero ? (hero.worn ?? EMPTY) : EMPTY
}
