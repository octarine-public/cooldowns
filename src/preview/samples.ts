import { ItemDisplay, ModifierDisplay, SpellDisplay } from "../gui/types"

function texture(name: string): string {
	return (
		AbilityData.GetAbilityByName(name)?.TexturePath ??
		(name.startsWith("item_")
			? `${PathData.ItemImagePath}/${name.slice(5)}_png.vtex_c`
			: `${PathData.AbilityImagePath}/${name}_png.vtex_c`)
	)
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
		return texture(this.name)
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
		return texture(this.name)
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
		return texture(this.name)
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

export class PreviewSamples {
	public readonly Spells: [SampleSpell, number][] = [
		[new SampleSpell("void_spirit_aether_remnant", 4), 0],
		[new SampleSpell("void_spirit_dissimilate", 2), 1],
		[new SampleSpell("void_spirit_resonant_pulse", 3), 2],
		[new SampleSpell("void_spirit_astral_step", 2, 3, 2), 3]
	]
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
