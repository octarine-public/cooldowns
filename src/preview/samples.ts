import { ItemDisplay, ModifierDisplay, SpellDisplay } from "../gui/types"

/**
 * The preview's own copy of an icon, shipped with the package. The host cuts a sized copy of a
 * game texture from what the engine holds of it, and the engine streams a texture in only for
 * what it shows itself, so a copy cut for the preview came out as a blot of the icon's average
 * colour whenever the game had no use for the texture at the time. A file of the package's own
 * is decoded whole.
 */
function art(name: string): string {
	const file = name.startsWith("item_") ? name.slice(5) : name
	return `${__OCT_PACKAGE_ROOT__}/scripts_files/cooldowns/preview/art/${file}.png`
}

class SampleSpell implements SpellDisplay {
	public Cooldown = 0
	public readonly Owner = undefined
	public readonly IsActivated = true
	public readonly IsInAbilityPhase = false
	public readonly IsChanneling = false
	public readonly AltCastState = false
	public readonly IsPassive = false

	constructor(
		private readonly name: string,
		public readonly Level: number,
		public readonly MaxLevel = 4,
		public readonly CurrentCharges = 0
	) {}

	public get TexturePath(): string {
		return art(this.name)
	}
	public IsManaEnough(): boolean {
		return true
	}
	public HasBehavior(): boolean {
		return false
	}
}

class SampleItem implements ItemDisplay {
	public Cooldown = 0
	public readonly IsMuted = false
	constructor(
		private readonly name: string,
		public readonly CurrentCharges = 0
	) {}
	public get TexturePath(): string {
		return art(this.name)
	}
	public HasBehavior(): boolean {
		return false
	}
}

export class SampleModifier implements ModifierDisplay {
	public RemainingTime = 8
	public readonly Duration = 8
	public readonly Caster = undefined
	public readonly ForceVisible = false
	constructor(
		public readonly Category: "Important" | "Buffs" | "Debuffs" | "Auras",
		private readonly name: string,
		public readonly StackCount = 0
	) {}
	public get Name(): string {
		return `modifier_${this.name}`
	}
	public GetTexturePath(): string {
		return art(this.name)
	}
	public IsShield(): boolean {
		return false
	}
	public IsBuff(): boolean {
		return this.Category === "Buffs" || this.Category === "Auras"
	}
	public IsChannel(): boolean {
		return false
	}
	public IsEnemy(): boolean {
		return true
	}
}

/** The shape of the sample strip: a level and, on the last one, charges, per slot. */
const SPELL_SLOTS: readonly [level: number, maxLevel: number, charges: number][] = [
	[4, 4, 0],
	[2, 4, 0],
	[3, 4, 0],
	[2, 3, 2]
]

export class PreviewSamples {
	public Spells: [SampleSpell, number][] = []
	public readonly Items = [
		new SampleItem("item_blink"),
		new SampleItem("item_black_king_bar"),
		new SampleItem("item_magic_wand", 12),
		new SampleItem("item_force_staff"),
		new SampleItem("item_cyclone"),
		new SampleItem("item_shivas_guard")
	]
	public readonly Modifiers = [
		new SampleModifier("Important", "crystal_maiden_frostbite"),
		new SampleModifier("Buffs", "item_blade_mail", 2),
		new SampleModifier("Debuffs", "silencer_curse_of_the_silent"),
		new SampleModifier("Auras", "item_shivas_guard")
	]

	/**
	 * Points the sample spells at a hero's own abilities, so the strip over a body is that body's
	 * bar. A hero with fewer than four keeps the slots it has; the levels and charges are the
	 * strip's rather than the hero's, since what is being shown is the drawing, not a build.
	 */
	public SetAbilities(abilities: readonly string[]): void {
		this.Spells = []
		for (let slot = 0; slot < abilities.length && slot < SPELL_SLOTS.length; slot++) {
			const [level, maxLevel, charges] = SPELL_SLOTS[slot]
			this.Spells.push([
				new SampleSpell(abilities[slot], level, maxLevel, charges),
				slot
			])
		}
	}

	public Tick(): void {
		const now = MenuSDK.PreviewClock()
		for (const [spell, index] of this.Spells) {
			spell.Cooldown = index === 2 ? 0 : Math.max(0, 8 - ((now + index * 2) % 12))
		}
		for (let index = 0; index < this.Items.length; index++) {
			this.Items[index].Cooldown =
				index === 2 ? 0 : Math.max(0, 12 - ((now + index * 3) % 16))
		}
		for (let index = 0; index < this.Modifiers.length; index++) {
			this.Modifiers[index].RemainingTime = 8 - ((now + index) % 8)
		}
	}
}
