import {
	Ability,
	Input,
	Item,
	Modifier,
	npc_dota_visage_familiar,
	Unit,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { ItemGUI } from "../gui/items"
import { ModifierGUI } from "../gui/modifiers"
import { SpellGUI } from "../gui/spells"
import { MenuManager } from "../menu/index"
import { ItemMenu } from "../menu/items"
import { ModifierMenu } from "../menu/modifiers"
import { SpellMenu } from "../menu/spells"

export class UnitData {
	private items: Item[] = []
	private spells: Ability[] = []
	private modifiers: Modifier[] = []

	private readonly itemGUI = new ItemGUI()
	private readonly spellGUI = new SpellGUI()
	private readonly modifierGUI = new ModifierGUI()

	constructor(public readonly Owner: Unit) {}

	public Draw(menu: MenuManager) {
		const itemMenu = menu.ItemMenu,
			spellMenu = menu.SpellMenu,
			modifierMenu = menu.ModifierMenu

		const itemState = itemMenu.State.value,
			spellState = spellMenu.State.value,
			modifierState = modifierMenu.State.value

		if (!itemState && !spellState && !modifierState) {
			return
		}
		const owner = this.Owner
		const isVisible = owner.IsFogVisible || owner.IsVisible
		if (!isVisible || !owner.IsAlive || owner.HideHud) {
			return
		}
		if (owner.IsCreep && !owner.IsSpawned) {
			return
		}
		const position = owner.HealthBarPosition()
		if (position === undefined) {
			return
		}

		const cursor = Input.CursorOnScreen,
			distanceScale = this.CalculateScale(cursor.Distance(position))

		const scale = menu.Scale.value ? distanceScale : 1
		let alpha = (menu.Opacity.value / 100) * 255
		if (menu.OpacityByCursor.value) {
			alpha *= distanceScale
		}

		this.UpdateGUI(scale, position, itemMenu, spellMenu, modifierMenu)

		if (itemState && this.items.length) {
			this.itemGUI.Draw(
				alpha,
				itemMenu,
				this.items,
				this.GetAdditionalPosition(itemMenu),
				owner.IsMuted
			)
		}

		if (spellState && this.spells.length) {
			this.spellGUI.Draw(
				alpha,
				spellMenu,
				this.spells,
				this.GetAdditionalPosition(spellMenu),
				owner.IsSilenced
			)
		}

		if (modifierState && this.modifiers.length) {
			this.modifierGUI.Draw(
				alpha,
				modifierMenu,
				this.modifiers,
				this.GetAdditionalPosition(modifierMenu)
			)
		}
	}

	public UnitItemsChanged(newItems: Item[]) {
		this.items = newItems
		this.items.orderBy(x => x.ItemSlot)
	}

	public UnitAbilitiesChanged(newAbils: Ability[]) {
		this.spells = newAbils
		this.spells.orderBy(x => x.AbilitySlot)
	}

	public ModifierCreated(modifier: Modifier) {
		if (!this.modifiers.includes(modifier)) {
			this.modifiers.push(modifier)
			this.modifiers.orderBy(x => x.CreationTime)
		}
	}

	public ModifierRemoved(modifier: Modifier) {
		this.modifiers.remove(modifier)
		this.modifiers.orderBy(x => x.CreationTime)
	}

	public ModifierRestart(newModifiers: Modifier[]) {
		this.modifiers = newModifiers
		this.modifiers.orderBy(x => x.CreationTime)
	}

	public EntityDestroyed(entity: Item | Ability) {
		switch (true) {
			case entity instanceof Item:
				this.items.remove(entity)
				this.items.orderBy(x => x.ItemSlot)
				break
			case entity instanceof Ability:
				this.spells.remove(entity)
				this.spells.orderBy(x => x.AbilitySlot)
				break
		}
	}

	protected GetAdditionalPosition(menu: ItemMenu | SpellMenu | ModifierMenu) {
		const owner = this.Owner
		if (
			owner instanceof npc_dota_visage_familiar &&
			(menu instanceof SpellMenu || menu instanceof ModifierMenu)
		) {
			return menu.Familiar.Position
		}
		if (owner.IsCreep && menu instanceof SpellMenu) {
			return menu.Creep.Position
		}
		switch (true) {
			case owner.IsHero:
				return menu.Hero.Position
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

	protected UpdateGUI(
		scale: number,
		position: Vector2,
		itemMenu: ItemMenu,
		spellMenu: SpellMenu,
		modifierMenu: ModifierMenu
	) {
		const itemState = itemMenu.State.value,
			spellState = spellMenu.State.value,
			modifierState = modifierMenu.State.value,
			healthBarSize = this.Owner.HealthBarSize

		if (itemState) {
			this.itemGUI.Update(position, healthBarSize, itemMenu.Size.value, scale)
		}

		if (spellState) {
			this.spellGUI.Update(position, healthBarSize, spellMenu.Size.value, scale)
		}

		if (modifierState) {
			this.modifierGUI.Update(
				position,
				healthBarSize,
				modifierMenu.Size.value,
				scale
			)
		}
	}

	protected CalculateScale(value: number) {
		return Math.min(Math.max(0.5, value / 150), 1)
	}
}
