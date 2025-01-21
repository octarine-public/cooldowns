import {
	Ability,
	GameState,
	GUIInfo,
	Input,
	Item,
	Modifier,
	npc_dota_brewmaster_earth,
	npc_dota_brewmaster_storm,
	npc_dota_brewmaster_void,
	npc_dota_visage_familiar,
	Unit,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "../enum"
import { ItemGUI } from "../gui/items"
import { ModifierGUI } from "../gui/modifiers"
import { SpellGUI } from "../gui/spells"
import { MenuManager } from "../menu/index"
import { ItemMenu } from "../menu/items"
import { BaseModifierMenu, ModifierMenu } from "../menu/modifiers"
import { SpellMenu } from "../menu/spells"

export class UnitData {
	private items: Item[] = []
	private spells: [Ability, number][] = []
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
		const alpha =
			menu.Opacity.value * (255 / 100) * (menu.OpacityByCursor.value ? -1 : 1)

		this.UpdateGUI(scale, position, itemMenu, spellMenu, modifierMenu)

		if (itemState && this.items.length) {
			this.itemGUI.Draw(
				alpha,
				itemMenu,
				this.items,
				this.GetAdditionalPosition(itemMenu),
				owner.IsMuted,
				owner.IsTethered
			)
		}

		if (spellState && this.spells.length) {
			this.spellGUI.Draw(
				alpha,
				spellMenu,
				this.spells,
				this.GetAdditionalPosition(spellMenu),
				owner.IsSilenced,
				owner.IsPassiveDisabled
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

	public UnitAbilitiesChanged(newAbils: [Ability, number][]) {
		this.spells = newAbils
		this.spells.orderBy(([, idx]) => idx)
	}

	public ModifierCreated(modifier: Modifier, menu: ModifierMenu) {
		this.modifiers.push(modifier)
		this.modifiers = this.SortModifiers(this.modifiers, menu)
	}

	public ModifierRemoved(modifier: Modifier, menu: ModifierMenu) {
		this.modifiers.remove(modifier)
		this.modifiers = this.SortModifiers(this.modifiers, menu)
	}

	public ModifierRestart(newModifiers: Modifier[], menu: ModifierMenu) {
		this.modifiers = newModifiers
		this.modifiers = this.SortModifiers(this.modifiers, menu)
	}

	public HasModifier(modifier: Modifier) {
		return this.modifiers.includes(modifier)
	}

	public EntityDestroyed(entity: Item | Ability) {
		switch (true) {
			case entity instanceof Item:
				this.items.remove(entity)
				this.items.orderBy(x => x.ItemSlot)
				break
			case entity instanceof Ability:
				this.spells.removeCallback(([x]) => x === entity)
				this.spells.orderBy(([, idx]) => idx)
				break
		}
	}

	public DisposeAll() {
		this.items.clear()
		this.spells.clear()
		this.modifiers.clear()
	}

	protected GetAdditionalPosition(menu: ItemMenu | SpellMenu | ModifierMenu) {
		const owner = this.Owner
		if (
			owner instanceof npc_dota_visage_familiar &&
			(menu instanceof SpellMenu || menu instanceof ModifierMenu)
		) {
			return menu.Familiar.Position
		}
		if (
			(owner instanceof npc_dota_brewmaster_void ||
				owner instanceof npc_dota_brewmaster_storm ||
				owner instanceof npc_dota_brewmaster_earth) &&
			(menu instanceof SpellMenu || menu instanceof ModifierMenu)
		) {
			return menu.Pandas.Position
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
		const startDistance = GUIInfo.ScaleHeight(150)
		return Math.min(Math.max(0.5, value / startDistance), 1)
	}

	protected SortModifiers(modifiers: Modifier[], menu: ModifierMenu) {
		const modifiersMap = new Map<string, Modifier>()
		for (let i = 0, end = modifiers.length; i < end; i++) {
			const modifier = modifiers[i]
			if (modifier === undefined || !modifier.IsValid) {
				this.modifiers.remove(modifier)
				continue
			}
			const keyName = this.getKeyName(modifier)
			if (!this.stateModifiers(modifier, menu)) {
				modifiersMap.delete(keyName)
				this.modifiers.remove(modifier)
				continue
			}
			const modifierInMap = modifiersMap.get(keyName)
			if (
				modifierInMap === undefined ||
				modifierInMap.RemainingTime < modifier.RemainingTime
			) {
				modifiersMap.set(keyName, modifier)
			}
		}
		return [...modifiersMap.values()].orderBy(x => -x.RemainingTime)
	}

	private getKeyName(modifier: Modifier) {
		if (modifier.Name === "modifier_rubick_spell_steal") {
			return modifier.GetTexturePath()
		}
		return modifier.Name
	}
	private stateModifiers(modifier: Modifier, menu: ModifierMenu) {
		if (modifier.ForceVisible) {
			return true
		}
		if (modifier.IsDisable() || modifier.IsShield() || modifier.IsChannel()) {
			return true
		}
		if (modifier.IsAura) {
			return this.stateAuras(menu)
		}
		if (modifier.IsBuff()) {
			return this.stateBuffs(menu)
		}
		if (modifier.IsDebuff()) {
			return this.stateDebuffs(menu)
		}
		return false
	}
	private stateAuras(menu: ModifierMenu) {
		return !this.isDisabledModifier(menu.Auras)
	}
	private stateBuffs(menu: ModifierMenu) {
		return !this.isDisabledModifier(menu.Buffs)
	}
	private stateDebuffs(menu: ModifierMenu) {
		return !this.isDisabledModifier(menu.Debuffs)
	}
	private isDisabledModifier(menu: BaseModifierMenu) {
		return (
			!menu.State.value ||
			!this.entityTeamState(menu) ||
			GameState.RawGameTime / 60 >= menu.DisableByTme.value
		)
	}
	private entityTeamState(menu: BaseModifierMenu) {
		switch (menu.TeamState.SelectedID) {
			case ETeamState.All:
				return true
			case ETeamState.Ally:
				return !this.Owner.IsEnemy() && !this.Owner.IsMyHero
			case ETeamState.AllyAndLocal:
				return !this.Owner.IsEnemy() || this.Owner.IsMyHero
			case ETeamState.Enemy:
				return this.Owner.IsEnemy()
			default:
				return false
		}
	}
}
