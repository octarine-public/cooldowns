import { MenuManager } from "../menu/index"
import { IsTeamSelected } from "../menu/team"

export class ItemManager {
	constructor(private readonly menu: MenuManager) {}

	public Get(unit: Unit): Item[] {
		if (unit.IsCreep && !unit.IsNeutral) {
			return []
		}
		if (unit.IsStrongIllusion && !unit.CanUseAllItems) {
			return []
		}
		if (
			!this.entityState(unit) ||
			!IsTeamSelected(unit, this.menu.ItemMenu.TeamState)
		) {
			return []
		}
		return unit.Inventory.Items
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
