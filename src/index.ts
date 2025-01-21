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
	SpiritBear,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "./menu/index"
import { UnitData } from "./models/unitData"
import { ItemManager } from "./modules/items"
import { ModifierManager } from "./modules/modifiers"
import { SpellManager } from "./modules/spells"

new (class CCooldowns {
	private readonly menu = new MenuManager()
	private readonly itemManager = new ItemManager(this.menu)
	private readonly spellManager = new SpellManager(this.menu)
	private readonly modifierManager = new ModifierManager(this.menu)

	private readonly units = new Map<Unit, UnitData>()

	constructor() {
		EventsSDK.on("Draw", this.Draw.bind(this))
		EventsSDK.on("EntityCreated", this.EntityCreated.bind(this))
		EventsSDK.on("EntityDestroyed", this.EntityDestroyed.bind(this))
		EventsSDK.on("UnitItemsChanged", this.UnitItemsChanged.bind(this))
		EventsSDK.on("ModifierCreated", this.ModifierCreated.bind(this))
		EventsSDK.on("ModifierChanged", this.ModifierChanged.bind(this))
		EventsSDK.on("ModifierRemoved", this.ModifierRemoved.bind(this))
		EventsSDK.on("UnitAbilitiesChanged", this.UnitAbilitiesChanged.bind(this))
		EventsSDK.on("UnitPropertyChanged", this.UnitPropertyChanged.bind(this))
		EventsSDK.on("AbilityHiddenChanged", this.AbilityHiddenChanged.bind(this))

		this.menu.MenuChnaged(() => this.menuChanged())
	}

	private get state() {
		return this.menu.State.value
	}

	private get isPostGame() {
		return (
			GameRules === undefined ||
			GameRules.GameState === DOTAGameState.DOTA_GAMERULES_STATE_POST_GAME
		)
	}

	private get isUIGame() {
		return GameState.UIState === DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME
	}

	protected Draw() {
		if (!this.state || this.isPostGame) {
			return
		}
		if (this.isUIGame) {
			this.units.forEach(unit => unit.Draw(this.menu))
		}
	}

	protected EntityCreated(entity: Entity) {
		if (this.shouldBeUnit(entity)) {
			this.updateAllManagers(entity)
		}
	}

	protected EntityDestroyed(entity: Entity) {
		if (this.shouldBeUnit(entity)) {
			this.units.delete(entity)
		}
	}

	protected UnitPropertyChanged(entity: Unit) {
		const getUnitData = this.units.get(entity)
		if (entity instanceof SpiritBear && !entity.ShouldRespawn) {
			getUnitData?.DisposeAll()
			this.units.delete(entity)
		}
		if (!this.isIllusion(entity)) {
			this.updateAllManagers(entity)
		}
	}

	protected AbilityHiddenChanged(abil: Ability) {
		const owner = abil.Owner
		if (this.shouldBeUnit(owner)) {
			this.getOrAddUnitData(owner)?.UnitAbilitiesChanged(
				this.spellManager.Get(owner)
			)
		}
	}

	protected UnitItemsChanged(unit: Unit) {
		if (this.shouldBeUnit(unit)) {
			this.getOrAddUnitData(unit)?.UnitItemsChanged(this.itemManager.Get(unit))
		}
	}

	protected UnitAbilitiesChanged(unit: Unit) {
		if (this.shouldBeUnit(unit)) {
			this.getOrAddUnitData(unit)?.UnitAbilitiesChanged(this.spellManager.Get(unit))
		}
	}

	protected ModifierChanged(modifier: Modifier) {
		const owner = modifier.Parent
		if (!this.shouldBeUnit(owner)) {
			return
		}
		const unitData = this.getOrAddUnitData(owner)
		if (unitData === undefined) {
			return
		}
		if (this.modifierManager.ShouldBeValid(owner, modifier)) {
			unitData.ModifierCreated(modifier, this.menu.ModifierMenu)
		} else {
			unitData.ModifierRemoved(modifier, this.menu.ModifierMenu)
		}
	}

	protected ModifierCreated(modifier: Modifier) {
		const owner = modifier.Parent
		if (!this.shouldBeUnit(owner)) {
			return
		}
		if (this.modifierManager.ShouldBeValid(owner, modifier)) {
			this.getOrAddUnitData(owner)?.ModifierCreated(
				modifier,
				this.menu.ModifierMenu
			)
		}
	}

	protected ModifierRemoved(modifier: Modifier) {
		const owner = modifier.Parent
		if (!this.shouldBeUnit(owner) || !this.modifierManager.EntityState(owner)) {
			return
		}
		this.getOrAddUnitData(owner)?.ModifierRemoved(modifier, this.menu.ModifierMenu)
	}

	private isIllusion(unit: Unit) {
		return unit.IsIllusion && !unit.IsStrongIllusion
	}

	private getOrAddUnitData(entity: Unit) {
		if (!entity.IsValid || this.isIllusion(entity)) {
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

	private shouldBeUnit(entity: Nullable<Entity>): entity is Unit {
		if (!(entity instanceof Unit) || this.isIllusion(entity)) {
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
		return entity.IsCreep && entity.IsNeutral
	}

	private updateAllManagers(entity: Unit) {
		const unitData = this.getOrAddUnitData(entity)
		unitData?.UnitItemsChanged(this.itemManager.Get(entity))
		unitData?.ModifierRestart(
			this.modifierManager.Get(entity),
			this.menu.ModifierMenu
		)
		unitData?.UnitAbilitiesChanged(this.spellManager.Get(entity))
	}

	private menuChanged() {
		const units = EntityManager.GetEntitiesByClass(Unit)
		for (let i = units.length - 1; i > -1; i--) {
			const unit = units[i]
			if (this.shouldBeUnit(unit)) {
				this.updateAllManagers(unit)
			}
		}
	}
})()
