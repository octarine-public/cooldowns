import { DOTAScriptInventorySlot, Unit } from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "../menu/index"

export class ItemManager {
	constructor(private readonly menu: MenuManager) {}

	public Get(unit: Nullable<Unit>) {
		if (unit === undefined || !this.stateByMenu(unit)) {
			return []
		}
		const inventory = unit.Inventory
		return inventory
			.GetItems(
				DOTAScriptInventorySlot.DOTA_ITEM_SLOT_1,
				DOTAScriptInventorySlot.DOTA_ITEM_SLOT_6
			)
			.concat(
				inventory.GetItems(
					DOTAScriptInventorySlot.DOTA_ITEM_TP_SCROLL,
					DOTAScriptInventorySlot.DOTA_ITEM_NEUTRAL_SLOT
				)
			)
	}

	private stateByMenu(entity: Unit) {
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
