import { Item, Unit } from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "../enum"
import { MenuManager } from "../menu/index"

export class ItemManager {
	constructor(private readonly menu: MenuManager) {}

	public Get(unit: Unit): Item[] {
		if (unit.IsCreep && !unit.IsNeutral) {
			return []
		}
		if (unit.IsStrongIllusion && !unit.CanUseAllItems) {
			return []
		}
		if (!this.entityState(unit) || !this.entityTeamState(unit)) {
			return []
		}
		return unit.Inventory.Items
	}
	private entityTeamState(entity: Unit) {
		switch (this.menu.ItemMenu.TeamState.SelectedID) {
			case ETeamState.All:
				return true
			case ETeamState.Ally:
				return !entity.IsEnemy() && !entity.IsMyHero
			case ETeamState.AllyAndLocal:
				return !entity.IsEnemy() || entity.IsMyHero
			case ETeamState.Enemy:
				return entity.IsEnemy()
			default:
				return false
		}
	}
	private entityState(entity: Unit) {
		const menu = this.menu.ItemMenu
		switch (true) {
			case entity.IsHero:
				return menu.Hero.State.value
			case entity.IsRoshan:
				return menu.Roshan.State.value
			case entity.IsCourier:
				return menu.Courier.State.value
			case entity.IsSpiritBear:
				return menu.SpiritBear.State.value
			default:
				return false
		}
	}
}
