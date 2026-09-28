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
	/**
	 * Every ability the game lists it with, in the order it lists them, out of which
	 * {@link BarAbilities} picks the four a bar shows.
	 */
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

/** How far down a hero's ability list the game's own reader looks, so as far as this one does. */
const ABILITY_SLOTS = 16
/** How many of those slots a bar shows, which is what the sample strip is a drawing of. */
const BAR_SLOTS = 4
/** The talents, which are abilities in the data and nothing a bar ever shows. */
const ABILITY_TALENT = "special_bonus"
/** The event abilities a hero carries out of season, which no bar shows either. */
const ABILITY_SEASONAL = "seasonal_"
/**
 * What the game writes into a slot it is keeping empty - `generic_hidden`, and the per-hero
 * hidden abilities that sit among the real ones. The game's own reader takes any name with this
 * in it, so this one does too.
 */
const ABILITY_HIDDEN = "hidden"
/** The behaviour of an innate that belongs in the hero's panel rather than on his bar. */
const INNATE_UI = DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_INNATE_UI
/** What a hero with no facets has of them, handed out rather than minted per pick. */
const NO_FACETS: ReadonlySet<string> = new Set()

/** Whether a name is an ability at all, rather than a talent or a slot kept empty. */
function named(ability: string): boolean {
	return (
		ability !== "" &&
		!ability.includes(ABILITY_HIDDEN) &&
		!ability.startsWith(ABILITY_TALENT) &&
		!ability.startsWith(ABILITY_SEASONAL)
	)
}

/**
 * Whether the game would put an ability on a bar, as far as its own data about it says.
 *
 * Not `AbilityData.ShouldBeDrawable`, which reads as though it were this and is not: it answers
 * out of a set that the three innates which DO belong on a bar - Mischief, Blur, Electromagnetic
 * Repulsion - put themselves into as they are built on the field. Nothing is built here, so it
 * is empty, and asking it would empty the strip. It is worth asking the other way round, as the
 * one thing that can excuse an innate.
 *
 * The rest is the rule the field's own abilities are drawn by, put to the data instead: the
 * attribute bonus, an innate - which the game draws under the bar and `ImageData` hands back the
 * facet diamond for rather than any art of its own - and, before a server has been joined, the
 * benefit of the doubt, since a name is all there is to go on then.
 */
function onBar(ability: string): boolean {
	const data = AbilityData.GetAbilityByName(ability)
	if (data === undefined) {
		return true
	}
	if (
		data.AbilityType === ABILITY_TYPES.ABILITY_TYPE_ATTRIBUTES ||
		data.HasBehavior(INNATE_UI)
	) {
		return false
	}
	return !data.IsInnate || AbilityData.ShouldBeDrawable.has(ability)
}

/**
 * The abilities a facet hands a hero. They are his with that facet picked and nobody else's, and
 * the card stands a hero rather than a build, so they are none of the four it draws.
 */
function facetAbilities(hero: string): ReadonlySet<string> {
	const facets = UnitData.GetUnitDataByName(hero)?.Facets
	if (facets === undefined || facets.length === 0) {
		return NO_FACETS
	}
	const granted = new Set<string>()
	for (const facet of facets) {
		for (const ability of facet.Abilities) {
			if (ability.AbilityName !== "") {
				granted.add(ability.AbilityName)
			}
		}
	}
	return granted
}

/**
 * The four a hero's bar shows, out of everything the game lists him with.
 *
 * A slot is not a bar. An innate sits among them, a facet's ability sits among them, a hidden
 * one is kept among them wherever a hero has a shard ability - and the ultimate is pushed past
 * the lot, which is why Bloodseeker's Rupture is his sixth slot. What is left after those are
 * dropped is the bar, and its first four are what a strip is drawn of.
 *
 * Picked here rather than where the roster is read, because the roster is read once - in the
 * dashboard, as often as not - and what says which of these is an innate is the game's data
 * about abilities, which is not there until a server has been joined. A hero is picked long
 * after that, and is picked again every time the dropdown moves.
 */
export function BarAbilities(hero: PreviewHero): readonly string[] {
	// the game's own list where it has read one, which is these same slots minus the hidden and
	// the talents; ours, read out of the file, until then
	const listed = UnitData.GetUnitDataByName(hero.name)?.Abilities
	const slots: Iterable<string> =
		listed !== undefined && listed.size !== 0 ? listed.keys() : hero.abilities
	const facets = facetAbilities(hero.name)
	const bar: string[] = []
	for (const ability of slots) {
		if (bar.length === BAR_SLOTS) {
			break
		}
		if (named(ability) && !facets.has(ability) && onBar(ability)) {
			bar.push(ability)
		}
	}
	return bar
}

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
		for (let slot = 1; slot <= ABILITY_SLOTS; slot++) {
			const ability = text(entry, `Ability${slot}`)
			if (named(ability)) {
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
