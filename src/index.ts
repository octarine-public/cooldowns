import "./translations"

import {
	Ability,
	courier_burst,
	courier_shield,
	DOTAGameState,
	DOTAGameUIState,
	DOTAScriptInventorySlot,
	Entity,
	EntityManager,
	EventsSDK,
	GameRules,
	GameState,
	high_five,
	Modifier,
	npc_dota_brewmaster_earth,
	npc_dota_brewmaster_storm,
	npc_dota_brewmaster_void,
	npc_dota_visage_familiar,
	plus_guild_banner,
	plus_high_five,
	SpiritBear,
	Team,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "./enum"
import { MenuManager } from "./menu/index"
import { UnitData } from "./models/index"

const bootstrap = new (class CCooldowns {
	private readonly menu = new MenuManager()
	private readonly units = new Map<Unit, UnitData>()

	constructor() {
		this.menu.MenuChnaged(() => this.menuChanged())
	}

	protected get State() {
		return this.menu.State.value
	}

	protected get IsPostGame() {
		return (
			GameRules === undefined ||
			GameRules.GameState === DOTAGameState.DOTA_GAMERULES_STATE_POST_GAME
		)
	}

	protected get IsUIGame() {
		return GameState.UIState === DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME
	}

	public Draw() {
		if (!this.State || this.IsPostGame) {
			return
		}
		if (this.IsUIGame) {
			this.units.forEach(unit => unit.Draw(this.menu))
		}
	}

	public EntityCreated(entity: Entity) {
		if (this.ShouldUnit(entity)) {
			this.updateAllAbilities(entity)
		}
	}

	public EntityDestroyed(entity: Entity) {
		if (this.ShouldUnit(entity)) {
			this.units.delete(entity)
		}
	}

	public UnitPropertyChanged(entity: Unit) {
		if (entity.IsIllusion) {
			return
		}
		if (entity instanceof SpiritBear && !entity.ShouldRespawn) {
			this.units.delete(entity)
		}
		if (entity.IsClone) {
			this.updateAllAbilities(entity)
		}
	}

	public UnitItemsChanged(unit: Unit) {
		if (this.ShouldUnit(unit)) {
			this.GetOrAddUnitData(unit)?.UnitItemsChanged(this.getItems(unit))
		}
	}

	public AbilityHiddenChanged(abil: Ability) {
		const owner = abil.Owner
		if (owner === undefined) {
			return
		}
		if (this.ShouldUnit(owner)) {
			this.updateAllAbilities(owner)
		}
	}

	public UnitAbilitiesChanged(unit: Unit) {
		if (!this.ShouldUnit(unit)) {
			return
		}
		this.GetOrAddUnitData(unit)?.UnitAbilitiesChanged(this.getSpells(unit))
	}

	public ModifierCreated(modifier: Modifier) {
		/** todo */
	}

	public ModifierRemoved(modifier: Modifier) {
		// const owner = modifier.Parent
		// if (owner === undefined) {
		// 	return
		// }
		//this.GetOrAddUnitData(owner)?.ModifierRemoved(modifier)
	}

	public GameChanged() {
		this.menu.GameChanged()
	}

	protected GetStateByTeam(unit: Unit, teamState: ETeamState) {
		if (unit.IsMyHero && !this.menu.Local.value) {
			return false
		}
		const isEnemy = unit.IsEnemy(),
			stateAlly = teamState === ETeamState.Ally,
			stateEnemy = teamState === ETeamState.Enemy
		return (
			!(stateEnemy && !isEnemy) &&
			!(isEnemy && stateAlly && GameState.LocalTeam !== Team.Observer)
		)
	}

	protected GetOrAddUnitData(entity: Unit) {
		if (!entity.IsValid || !this.GetStateByTeam(entity, this.menu.Team.SelectedID)) {
			this.units.delete(entity)
			return
		}
		let getUnitData = this.units.get(entity)
		if (getUnitData === undefined) {
			getUnitData = new UnitData(entity)
			this.units.set(entity, getUnitData)
			return getUnitData
		}
		return getUnitData
	}

	protected ShouldUnit(entity: Entity): entity is Unit {
		// todo Entity#IsUnit() ?
		if (!(entity instanceof Unit)) {
			return false
		}
		if (!entity.CanUseAbilities && !entity.CanUseItems) {
			return false
		}
		if (entity.IsHero || entity.IsRoshan || entity.IsCourier) {
			return true
		}
		if (entity instanceof SpiritBear) {
			return entity.ShouldRespawn
		}
		if (
			entity instanceof npc_dota_visage_familiar ||
			entity instanceof npc_dota_brewmaster_void ||
			entity instanceof npc_dota_brewmaster_storm ||
			entity instanceof npc_dota_brewmaster_earth
		) {
			return true
		}
		if (entity.IsCreep && entity.IsNeutral) {
			return true
		}
		return false
	}

	private getItems(unit: Nullable<Unit>) {
		if (unit === undefined || !this.stateItemUnitByMenu(unit)) {
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

	private getSpells(unit: Nullable<Unit>) {
		if (unit === undefined || !this.stateSpellUnitByMenu(unit)) {
			return []
		}
		return unit.Spells.filter(
			abil => abil !== undefined && !this.shouldExcludeSpells(unit, abil)
		) as Ability[]
	}

	private updateAllAbilities(entity: Unit) {
		const unitData = this.GetOrAddUnitData(entity)
		unitData?.UnitItemsChanged(this.getItems(entity))
		unitData?.UnitAbilitiesChanged(this.getSpells(entity))
	}

	private shouldExcludeSpells(unit: Unit, abil: Ability) {
		if (abil.MaxLevel === 0 || abil.IsAttributes) {
			return true
		}
		if ((abil.IsHidden && !abil.IsEmpty) || abil.Name.includes("seasonal_")) {
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

	private menuChanged() {
		const units = EntityManager.GetEntitiesByClass(Unit)
		for (let index = units.length - 1; index > -1; index--) {
			const unit = units[index]
			if (this.ShouldUnit(unit)) {
				this.updateAllAbilities(unit)
			}
		}
	}

	private stateItemUnitByMenu(entity: Unit) {
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

	private stateSpellUnitByMenu(entity: Unit) {
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
})()

EventsSDK.on("Draw", () => bootstrap.Draw())

EventsSDK.on("GameEnded", () => bootstrap.GameChanged())

EventsSDK.on("GameStarted", () => bootstrap.GameChanged())

EventsSDK.on("EntityCreated", entity => bootstrap.EntityCreated(entity))

EventsSDK.on("EntityDestroyed", entity => bootstrap.EntityDestroyed(entity))

EventsSDK.on("UnitItemsChanged", unit => bootstrap.UnitItemsChanged(unit))

EventsSDK.on("UnitAbilitiesChanged", unit => bootstrap.UnitAbilitiesChanged(unit))

EventsSDK.on("UnitPropertyChanged", unit => bootstrap.UnitPropertyChanged(unit))

EventsSDK.on("AbilityHiddenChanged", abil => bootstrap.AbilityHiddenChanged(abil))

EventsSDK.on("ModifierCreated", modifier => bootstrap.ModifierCreated(modifier))

EventsSDK.on("ModifierRemoved", modifier => bootstrap.ModifierRemoved(modifier))
