import {
	Ability,
	courier_burst,
	courier_shield,
	high_five,
	npc_dota_visage_familiar,
	plus_guild_banner,
	plus_high_five,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "../menu/index"

export class SpellManager {
	constructor(private readonly menu: MenuManager) {}

	public Get(unit: Nullable<Unit>) {
		if (unit === undefined || !this.stateByMenu(unit) || !unit.CanUseAbilities) {
			return []
		}
		return unit.Spells.filter(
			abil => abil !== undefined && !this.shouldExclude(unit, abil)
		) as Ability[]
	}

	private shouldExclude(unit: Unit, abil: Ability) {
		if (abil.MaxLevel === 0 || abil.IsHidden || abil.IsAttributes) {
			return true
		}
		if (abil.Name.includes("seasonal_")) {
			return true
		}
		if (unit.IsCreep && unit.IsNeutral) {
			return abil.IsPassive // exclude passive abilities on creeps
		}
		if (unit.IsCourier) {
			return !(abil instanceof courier_burst || abil instanceof courier_shield)
		}
		return (
			abil instanceof high_five ||
			abil instanceof plus_high_five ||
			abil instanceof plus_guild_banner
		)
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
