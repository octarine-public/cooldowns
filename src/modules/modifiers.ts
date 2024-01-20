import {
	Modifier,
	npc_dota_visage_familiar,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "../menu"

export class ModifierManager {
	private readonly ignoreList = new Set<string>(["modifier_lion_finger_of_death"])

	private readonly allowAuraList = new Set<string>([
		"modifier_nevermore_presence",
		"modifier_necrolyte_heartstopper_aura_effect"
	])

	private readonly allowDurationList = new Set<string>([
		"modifier_slardar_bash_active",
		"modifier_life_stealer_infest_effect",
		"modifier_spirit_breaker_charge_of_darkness_vision"
	])

	constructor(private readonly menu: MenuManager) {}

	public Should(unit: Nullable<Unit>, modifier: Modifier) {
		return this.stateByMenu(unit) && this.shouldExclude(modifier)
	}

	private shouldExclude(modifier: Modifier) {
		switch (true) {
			case modifier.IsAura && !this.allowAuraList.has(modifier.Name):
				return false
			case modifier.Duration === -1 && !this.allowDurationList.has(modifier.Name):
				return false
			case modifier.Name.endsWith("_counter") || this.ignoreList.has(modifier.Name):
				return false
			default:
				return true
		}
	}

	private stateByMenu(entity: Nullable<Unit>) {
		if (entity === undefined) {
			return false
		}
		const menu = this.menu.SpellMenu
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
}
