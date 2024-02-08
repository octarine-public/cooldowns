import {
	Modifier,
	npc_dota_visage_familiar,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "../menu/index"

export class ModifierManager {
	// check by stack count changed
	private readonly checkStateList = new Set<string>([
		"modifier_lina_fiery_soul",
		"modifier_slardar_bash_active",
		"modifier_slark_essence_shift",
		"modifier_bristleback_warpath",
		"modifier_item_eternal_shroud",
		"modifier_shredder_reactive_armor",
		"modifier_huskar_burning_spear_debuff",
		"modifier_slark_essence_shift_permanent_debuff",
		"modifier_skywrath_mage_shard_bonus_counter",
		"modifier_dazzle_bad_juju_armor_counter",
		"modifier_dazzle_bad_juju_manacost",
		"modifier_undying_decay_debuff_counter",
		"modifier_silencer_glaives_of_wisdom_buff_counter",
		"modifier_silencer_glaives_of_wisdom_debuff_counter",
		"modifier_abyssal_underlord_atrophy_aura_dmg_buff_counter"
	])
	// full ignore modifier name list
	private readonly ignoreList = new Set<string>([
		"modifier_razor_static_link",
		"modifier_razor_link_vision",
		"modifier_lion_finger_of_death",
		"modifier_slark_essence_shift_buff",
		"modifier_slark_essence_shift_debuff",
		"modifier_special_bonus_attributes",
		"modifier_skywrath_mage_shard_bonus",
		"modifier_teleporting_root_logic",
		"modifier_dazzle_bad_juju_armor",
		"modifier_undying_decay_debuff",
		"modifier_undying_decay_buff",
		"modifier_dragon_knight_frost_breath",
		"modifier_dragon_knight_splash_attack",
		"modifier_dragon_knight_corrosive_breath",
		"modifier_silencer_glaives_of_wisdom",
		"modifier_silencer_glaives_of_wisdom_buff",
		"modifier_silencer_glaives_of_wisdom_debuff",
		"modifier_item_eternal_shroud_bonus_magic_resist",
		"modifier_abyssal_underlord_atrophy_aura_creep_buff"
	])

	// ignore ends with modifier name
	private readonly ignoreByEnds: string[] = [
		"_aura",
		"_stack",
		"_counter",
		"_pull",
		"_push",
		"_tooltip"
	]

	constructor(private readonly menu: MenuManager) {}

	public ShouldBeValid(owner: Nullable<Unit>, modifier: Modifier) {
		return this.stateByMenu(owner) && this.shouldBeValid(modifier)
	}

	public Get(owner: Nullable<Unit>) {
		if (owner === undefined || !this.stateByMenu(owner)) {
			return []
		}
		return owner.Buffs.filter(modifier => this.shouldBeValid(modifier))
	}

	private shouldBeValid(modifier: Modifier) {
		if (!modifier.IsValid || modifier.IsAura || this.ignoreList.has(modifier.Name)) {
			return false
		}
		if (!modifier.GetTexturePath().length) {
			return false
		}
		if (this.checkStateList.has(modifier.Name)) {
			return modifier.StackCount !== 0
		}
		if (this.isPostfix(modifier.Name)) {
			return false
		}
		return modifier.Duration !== -1
	}

	private stateByMenu(entity: Nullable<Unit>) {
		if (entity === undefined) {
			return false
		}
		const menu = this.menu.ModifierMenu
		switch (true) {
			case entity.IsHero:
				return menu.Hero.State.value
			case entity.IsRoshan:
				return menu.Roshan.State.value
			case entity.IsCourier:
				return menu.Courier.State.value
			case entity.IsSpiritBear:
				return menu.SpiritBear.State.value
			case entity instanceof npc_dota_visage_familiar:
				return menu.Familiar.State.value
			default:
				return false
		}
	}

	private isPostfix(modifierName: string) {
		return this.ignoreByEnds.some(endName => modifierName.endsWith(endName))
	}
}
