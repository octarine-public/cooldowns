import {
	Ability,
	courier_burst,
	courier_shield,
	npc_dota_visage_familiar,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "../menu/index"

export class SpellManager {
	constructor(private readonly menu: MenuManager) {}

	public Get(unit: Nullable<Unit>) {
		if (unit === undefined || !this.stateByMenu(unit) || !unit.CanUseAbilities) {
			return []
		}
		return unit.Spells.filter(abil => this.shouldDrawable(unit, abil)) as Ability[]
	}

	private shouldDrawable(unit: Unit, abil: Nullable<Ability>) {
		if (abil === undefined || !abil.ShouldBeDrawable || abil.IsHidden) {
			return false
		}
		if (unit.IsCreep && unit.IsNeutral) {
			return !abil.IsPassive // exclude passive abilities on creeps
		}
		if (unit.IsCourier) {
			return abil instanceof courier_burst || abil instanceof courier_shield
		}
		return true
	}

	private stateByMenu(entity: Unit) {
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
			case entity.IsCreep && entity.IsNeutral:
				return menu.Creep.State.value
			default:
				return false
		}
	}
}
