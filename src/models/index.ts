import {
	Ability,
	Item,
	npc_dota_visage_familiar,
	Unit,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { BaseGUI } from "../gui/index"
import { MenuManager } from "../menu"
import { ItemMenu } from "../menu/items"
import { SpellMenu } from "../menu/spells"

export class UnitData {
	protected items: Item[] = []
	protected spells: Ability[] = []
	protected readonly gui = new BaseGUI()

	constructor(public readonly Owner: Unit) {}

	public Draw(menu: MenuManager) {
		const itemMenu = menu.ItemMenu,
			spellMenu = menu.SpellMenu

		const itemState = itemMenu.State.value
		const spellState = spellMenu.State.value
		if (!itemState && !spellState) {
			return
		}

		const owner = this.Owner
		if (!owner.IsVisible || !owner.IsAlive || (owner.IsCreep && !owner.IsSpawned)) {
			return
		}

		const position = owner.HealthBarPosition()
		if (position === undefined) {
			return
		}

		this.gui.Update(
			position,
			this.Owner.HealthBarSize,
			itemMenu.Size.value,
			spellMenu.Size.value,
			itemState,
			spellState
		)

		if (itemState && this.items.length) {
			this.gui.DrawItems(
				itemMenu,
				owner.IsMuted,
				this.items,
				this.GetAdditional(itemMenu)
			)
		}

		if (spellState && this.spells.length) {
			this.gui.DrawSpells(
				spellMenu,
				owner.IsSilenced,
				this.spells,
				this.GetAdditional(spellMenu)
			)
		}
	}

	public UnitItemsChanged(newItems: Item[]) {
		this.items = newItems
	}

	public UnitAbilitiesChanged(newAbils: Ability[]) {
		this.spells = newAbils
		this.spells.orderBy(x => x.IsUltimate)
	}

	public EntityDestroyed(entity: Item | Ability) {
		switch (true) {
			case entity instanceof Item:
				this.items.remove(entity)
				this.items.orderBy(x => -x.Slot)
				break
			case entity instanceof Ability:
				this.spells.remove(entity)
				this.spells.orderBy(x => x.IsUltimate)
				break
		}
	}

	protected GetAdditional(menu: ItemMenu | SpellMenu) {
		const owner = this.Owner
		switch (true) {
			case owner.IsHero:
				return menu.Hero.Position
			case menu.IsSpellMenu<SpellMenu>(menu) &&
				owner instanceof npc_dota_visage_familiar:
				return menu.Familiar.Position
			case menu.IsSpellMenu<SpellMenu>(menu) && owner.IsCreep:
				return menu.Creep.Position
			case owner.IsRoshan:
				return menu.Roshan.Position
			case owner.IsCourier:
				return menu.Courier.Position
			case owner.IsSpiritBear:
				return menu.SpiritBear.Position
			default:
				return new Vector2()
		}
	}
}
