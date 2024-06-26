import "./translations"

import {
	Ability,
	DOTAGameState,
	DOTAGameUIState,
	Entity,
	EntityManager,
	EventsSDK,
	GameRules,
	GameState,
	Modifier,
	npc_dota_brewmaster_earth,
	npc_dota_brewmaster_storm,
	npc_dota_brewmaster_void,
	npc_dota_visage_familiar,
	Sleeper,
	SpiritBear,
	Team,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "./enum"
import { MenuManager } from "./menu/index"
import { UnitData } from "./models/index"
import { ItemManager } from "./modules/items"
import { ModifierManager } from "./modules/modifiers"
import { SpellManager } from "./modules/spells"

const bootstrap = new (class CCooldowns {
	private readonly sleeper = new Sleeper()
	private readonly units = new Map<Unit, UnitData>()

	private readonly menu = new MenuManager(this.sleeper)
	private readonly itemManager = new ItemManager(this.menu)
	private readonly spellManager = new SpellManager(this.menu)
	private readonly modifierManager = new ModifierManager(this.menu)

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

	protected IsIllusion(unit: Unit) {
		return unit.IsIllusion && !unit.IsStrongIllusion
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
		if (this.ShouldBeUnit(entity)) {
			this.updateAllManagers(entity)
		}
	}

	public EntityDestroyed(entity: Entity) {
		if (this.ShouldBeUnit(entity)) {
			this.units.delete(entity)
		}
	}

	public UnitPropertyChanged(entity: Unit) {
		if (this.IsIllusion(entity)) {
			return
		}
		const getUnitData = this.units.get(entity)
		if (entity instanceof SpiritBear && !entity.ShouldRespawn) {
			getUnitData?.DisposeAll()
			this.units.delete(entity)
		}
		if (entity.IsClone || entity.IsStrongIllusion) {
			this.updateAllManagers(entity)
		}
	}

	public AbilityHiddenChanged(abil: Ability) {
		const owner = abil.Owner
		if (this.ShouldBeUnit(owner)) {
			this.GetOrAddUnitData(owner)?.UnitAbilitiesChanged(
				this.spellManager.Get(owner)
			)
		}
	}

	public UnitItemsChanged(unit: Unit) {
		if (this.ShouldBeUnit(unit)) {
			this.GetOrAddUnitData(unit)?.UnitItemsChanged(this.itemManager.Get(unit))
		}
	}

	public UnitAbilitiesChanged(unit: Unit) {
		if (this.ShouldBeUnit(unit)) {
			this.GetOrAddUnitData(unit)?.UnitAbilitiesChanged(this.spellManager.Get(unit))
		}
	}

	public ModifierChanged(modifier: Modifier) {
		const owner = modifier.Parent
		if (!this.ShouldBeUnit(owner)) {
			return
		}
		const unitData = this.GetOrAddUnitData(owner)
		if (unitData === undefined) {
			return
		}
		if (this.modifierManager.ShouldBeValid(owner, modifier)) {
			unitData.ModifierCreated(modifier)
		} else {
			unitData.ModifierRemoved(modifier)
		}
	}

	public ModifierCreated(modifier: Modifier) {
		const owner = modifier.Parent
		if (!this.ShouldBeUnit(owner)) {
			return
		}
		if (this.modifierManager.ShouldBeValid(owner, modifier)) {
			this.GetOrAddUnitData(owner)?.ModifierCreated(modifier)
		}
	}

	public ModifierRemoved(modifier: Modifier) {
		const owner = modifier.Parent
		if (!this.ShouldBeUnit(owner) || !this.modifierManager.StateByMenu(owner)) {
			return
		}
		const unitData = this.GetOrAddUnitData(owner)
		if (unitData === undefined) {
			return
		}
		if (unitData.HasModifier(modifier)) {
			unitData.ModifierRemoved(modifier)
		}
	}

	public GameChanged() {
		this.menu.GameChanged()
	}

	protected GetStateByTeam(
		unit: Unit,
		teamState: ETeamState = this.menu.Team.SelectedID
	) {
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
		if (!entity.IsValid || this.IsIllusion(entity) || !this.GetStateByTeam(entity)) {
			this.units.get(entity)?.DisposeAll()
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

	protected ShouldBeUnit(entity: Nullable<Entity>): entity is Unit {
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

	private updateAllManagers(entity: Unit) {
		const unitData = this.GetOrAddUnitData(entity)
		unitData?.UnitItemsChanged(this.itemManager.Get(entity))
		unitData?.ModifierRestart(this.modifierManager.Get(entity))
		unitData?.UnitAbilitiesChanged(this.spellManager.Get(entity))
	}

	private menuChanged() {
		const units = EntityManager.GetEntitiesByClass(Unit)
		for (let index = units.length - 1; index > -1; index--) {
			const unit = units[index]
			if (this.ShouldBeUnit(unit)) {
				this.updateAllManagers(unit)
			}
		}
	}
})()

EventsSDK.on("Draw", () => bootstrap.Draw())

EventsSDK.on("GameEnded", () => bootstrap.GameChanged())

EventsSDK.on("GameStarted", () => bootstrap.GameChanged())

EventsSDK.on("EntityCreated", entity => bootstrap.EntityCreated(entity))

EventsSDK.on("EntityDestroyed", entity => bootstrap.EntityDestroyed(entity))

EventsSDK.on("UnitItemsChanged", unit => bootstrap.UnitItemsChanged(unit))

EventsSDK.on("ModifierCreated", modifier => bootstrap.ModifierCreated(modifier))

EventsSDK.on("ModifierChanged", modifier => bootstrap.ModifierChanged(modifier))

EventsSDK.on("ModifierRemoved", modifier => bootstrap.ModifierRemoved(modifier))

EventsSDK.on("UnitAbilitiesChanged", unit => bootstrap.UnitAbilitiesChanged(unit))

EventsSDK.on("UnitPropertyChanged", unit => bootstrap.UnitPropertyChanged(unit))

EventsSDK.on("AbilityHiddenChanged", abil => bootstrap.AbilityHiddenChanged(abil))
