import {
	Ability,
	AnchorKind,
	GameState,
	GUIInfo,
	Input,
	Item,
	Modifier,
	npc_dota_brewmaster_earth,
	npc_dota_brewmaster_storm,
	npc_dota_brewmaster_void,
	npc_dota_visage_familiar,
	RendererSDK,
	Unit,
	Vector2,
	Vector3
} from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "../enum"
import { ItemGUI } from "../gui/items"
import { ModifierGUI } from "../gui/modifiers"
import { SpellGUI } from "../gui/spells"
import { MenuManager } from "../menu/index"
import { ItemMenu } from "../menu/items"
import { BaseModifierMenu, ModifierMenu } from "../menu/modifiers"
import { SpellMenu } from "../menu/spells"

const TP_END_KIND = RendererSDK.AllocateAnchorKind()

export class UnitData {
	public Priority: number = Infinity
	private items: Item[] = []
	private spells: [Ability, number][] = []
	private modifiers: Modifier[] = []

	private readonly itemGUI = new ItemGUI()
	private readonly spellGUI = new SpellGUI()
	private readonly modifierGUI = new ModifierGUI()

	private static readonly drawAnchor = new Vector2()

	constructor(public readonly Owner: Unit) {}

	public get IsTeleported() {
		return this.Owner.TPStartPosition.IsValid && this.Owner.TPEndPosition.IsValid
	}
	protected get Positions(): [Nullable<Vector2>, Nullable<Vector2>] {
		const owner = this.Owner,
			start = this.IsTeleported ? owner.TPStartPosition : owner.Position,
			end = this.IsTeleported ? owner.TPEndPosition : undefined
		return [
			this.HealthBarPosition(owner, start),
			end?.IsValid ? this.HealthBarPosition(owner, end) : undefined
		]
	}
	public DrawContent2D(menu: MenuManager): void {
		this.Priority = Infinity
		if (!this.isShown()) {
			return
		}
		const itemMenu = menu.ItemMenu,
			spellMenu = menu.SpellMenu,
			modifierMenu = menu.ModifierMenu

		if (
			!itemMenu.State.value &&
			!spellMenu.State.value &&
			!modifierMenu.State.value
		) {
			return
		}
		if (!this.items.length && !this.spells.length && !this.modifiers.length) {
			return
		}

		let [position, positionEnd] = this.Positions
		if (position !== undefined && UnitData.hudContains(position)) {
			position = undefined
		}
		if (positionEnd !== undefined && UnitData.hudContains(positionEnd)) {
			positionEnd = undefined
		}
		if (position === undefined && positionEnd === undefined) {
			return
		}
		this.setPriority(position, positionEnd)
		const scale = menu.Scale.value
			? this.getDistanceScale(position, positionEnd)
			: 1
		const alpha =
			menu.Opacity.value * (255 / 100) * (menu.OpacityByCursor.value ? -1 : 1)

		this.UpdateGUI(
			scale,
			UnitData.drawAnchor,
			undefined,
			itemMenu,
			spellMenu,
			modifierMenu
		)

		const index = this.Owner.Index
		if (position !== undefined) {
			RendererSDK.DrawEntityRelative(
				index,
				AnchorKind.HealthBar,
				() => this.Positions[0],
				() => this.DrawBlock(menu, alpha, position)
			)
		}
		if (this.IsTeleported && positionEnd !== undefined) {
			RendererSDK.DrawEntityRelative(
				index,
				TP_END_KIND,
				() => this.Positions[1],
				() => this.DrawBlock(menu, alpha, positionEnd)
			)
		}
	}
	private DrawBlock(menu: MenuManager, alpha: number, realAnchor: Vector2) {
		const owner = this.Owner
		this.itemGUI.realAnchor.CopyFrom(realAnchor)
		this.spellGUI.realAnchor.CopyFrom(realAnchor)
		this.modifierGUI.realAnchor.CopyFrom(realAnchor)
		if (menu.ItemMenu.State.value && this.items.length) {
			this.itemGUI.Draw(
				alpha,
				menu.ItemMenu,
				this.items,
				this.GetAdditionalPosition(menu.ItemMenu),
				owner.IsMuted,
				owner.IsTethered
			)
		}
		if (menu.SpellMenu.State.value && this.spells.length) {
			this.spellGUI.Draw(
				alpha,
				menu.SpellMenu,
				this.spells,
				this.GetAdditionalPosition(menu.SpellMenu),
				owner.IsSilenced,
				owner.IsPassiveDisabled
			)
		}
		if (menu.ModifierMenu.State.value && this.modifiers.length) {
			this.modifierGUI.Draw(
				alpha,
				menu.ModifierMenu,
				this.modifiers,
				this.GetAdditionalPosition(menu.ModifierMenu)
			)
		}
	}
	private isShown(): boolean {
		const owner = this.Owner
		const isVisible = this.IsTeleported || owner.IsFogVisible || owner.IsVisible
		if (!isVisible || !owner.IsAlive || owner.IsHideWorldHud) {
			return false
		}
		if (owner.IsCreep && !owner.IsSpawned) {
			return false
		}
		return true
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
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		itemMenu: ItemMenu,
		spellMenu: SpellMenu,
		modifierMenu: ModifierMenu
	) {
		const itemState = itemMenu.State.value,
			spellState = spellMenu.State.value,
			modifierState = modifierMenu.State.value,
			healthBarSize = this.Owner.HealthBarSize

		if (itemState) {
			this.itemGUI.Update(
				position,
				positionEnd,
				healthBarSize,
				itemMenu.Size.value,
				scale
			)
		}
		if (spellState) {
			this.spellGUI.Update(
				position,
				positionEnd,
				healthBarSize,
				spellMenu.Size.value,
				scale
			)
		}
		if (modifierState) {
			this.modifierGUI.Update(
				position,
				positionEnd,
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
	public HealthBarPosition(
		owner: Unit,
		origin: Nullable<Vector3> = undefined
	): Nullable<Vector2> {
		const position = (origin ?? owner.Position)
			.Clone()
			.AddScalarZ(owner.HealthBarOffset)
		const screenPosition = RendererSDK.WorldToScreen(position)
		if (screenPosition === undefined) {
			return undefined
		}
		if (owner.HasVisualShield) {
			screenPosition.AddScalarY(5)
		}
		return screenPosition.SubtractForThis(owner.HealthBarPositionCorrection)
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
			return this.entityTeamState(menu.Important)
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
	private getDistanceScale(start: Nullable<Vector2>, end: Nullable<Vector2>) {
		const position = start ?? end
		return position !== undefined
			? this.CalculateScale(Input.CursorOnScreen.Distance(position))
			: 1
	}
	private setPriority(start: Nullable<Vector2>, end: Nullable<Vector2>) {
		const w2s = RendererSDK.WorldToScreen(this.Owner.Position) ?? start ?? end
		this.Priority =
			w2s !== undefined ? w2s.DistanceSqr(Input.CursorOnScreen) : Infinity
	}
	private static hudContains(position: Vector2): boolean {
		return (
			GUIInfo.ContainsShop(position) ||
			GUIInfo.ContainsMiniMap(position) ||
			GUIInfo.ContainsScoreboard(position)
		)
	}
}
