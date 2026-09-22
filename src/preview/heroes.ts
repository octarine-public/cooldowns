/** A hero as the stage needs one: what to stand, what to dress it in, and what it casts. */
export interface PreviewHero {
	readonly name: string
	/** The hero's name as the game's own files write it, for the row that picks it. */
	readonly label: string
	readonly model: string
	/**
	 * Its default items, which are most of what makes a hero look like itself, or nothing while
	 * they have not been read. Reading them costs the whole econ file, so a hero is offered
	 * long before it is dressed; {@link Dressed} is what turns one into the other.
	 */
	readonly worn?: readonly string[]
	/** The four abilities on its bar, for the sample strip drawn over it. */
	readonly abilities: readonly string[]
}

/**
 * The hero the card shows until someone asks for another. His default items are written out here
 * rather than looked up: they are the only ones needed to open the page, and looking one hero's
 * up costs the whole econ file.
 */
export const DefaultHero: PreviewHero = {
	name: "npc_dota_hero_largo",
	label: "Largo",
	model: "models/heroes/bard/bard_frog_base.vmdl",
	worn: [
		"models/heroes/bard/bard_frog_upperbody.vmdl",
		"models/heroes/bard/bard_frog_lowerbody.vmdl",
		"models/heroes/bard/bard_frog_weapon.vmdl"
	],
	abilities: [
		"largo_catchy_lick",
		"largo_frogstomp",
		"largo_croak_of_genius",
		"largo_encore"
	]
}

/** What every hero's name in the game's data begins with, and nothing else's does. */
const HERO_PREFIX = "npc_dota_hero_"

/** Heroes the game keeps as data but never lets anyone pick. */
const ABILITY_NONE = "generic_hidden"
/**
 * How far down a hero's ability list to look for its bar. The four a player sees are not always
 * the first four slots: a hidden one sits among them wherever the hero has an innate or a shard
 * ability, and the ultimate is pushed past it - Bloodseeker's Rupture is his sixth.
 */
const ABILITY_SLOTS = 6
/** The talents, which are abilities in the data and nothing a bar ever shows. */
const ABILITY_TALENT = "special_bonus"

let roster: Nullable<PreviewHero[]>

/** One key of a KeyValues block as text; the host hands numbers back as numbers. */
function text(map: RecursiveMap, key: string): string {
	const value = map.get(key)
	if (typeof value === "string") {
		return value
	}
	return typeof value === "number" ? String(value) : ""
}

/**
 * Every hero the game will let you pick, read out of its own files.
 *
 * `npc_heroes.txt` is a list of `#base` includes and nothing else; the host's reader follows them,
 * so this one call is the whole roster with each hero's model and abilities, in a match or in the
 * dashboard. Read once and kept — the file does not change while the game is running.
 */
export function HeroRoster(): readonly PreviewHero[] {
	if (roster !== undefined) {
		return roster
	}
	roster = []
	if (typeof parseKV !== "function") {
		return roster
	}
	const heroes = parseKV("scripts/npc/npc_heroes.txt").get("DOTAHeroes")
	if (!(heroes instanceof Map)) {
		return roster
	}
	for (const [name, entry] of heroes) {
		if (!name.startsWith(HERO_PREFIX) || !(entry instanceof Map)) {
			continue
		}
		const model = text(entry, "Model")
		// the ones that are data rather than heroes: the base every hero inherits from, and those
		// the game has not turned on yet
		if (model === "" || text(entry, "Enabled") !== "1") {
			continue
		}
		const abilities: string[] = []
		for (let slot = 1; slot <= ABILITY_SLOTS && abilities.length < 4; slot++) {
			const ability = text(entry, `Ability${slot}`)
			if (
				ability !== "" &&
				ability !== ABILITY_NONE &&
				!ability.startsWith(ABILITY_TALENT)
			) {
				abilities.push(ability)
			}
		}
		// what the game calls him where it writes his name down, which is the only place a hero's
		// name is written the way a reader would say it
		const label = text(entry, "workshop_guide_name")
		roster.push({
			name,
			label: label !== "" ? label : name.slice(HERO_PREFIX.length),
			model,
			abilities
		})
	}
	roster.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
	return roster
}

/**
 * The hero with the items the game equips him with, read the first time he is actually shown.
 *
 * A hero is offered in the picker long before he stands on the stage, and the offer costs the
 * roster while the dressing costs the econ file: fifty megabytes for a few paths. So the list is
 * of undressed heroes and this is what dresses the one that is picked.
 */
export function Dressed(hero: PreviewHero): PreviewHero {
	return hero.worn !== undefined
		? hero
		: { ...hero, worn: WearableData.DefaultWearables(hero.name) }
}

/** The face the game draws for a hero, for the row that picks him. */
export function HeroIcon(hero: string): string {
	return `${PathData.HeroIconsPath}/${hero}_png.vtex_c`
}
