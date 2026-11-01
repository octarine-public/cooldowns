import "./translations"

import { surface } from "../render"
import { MenuManager } from "./menu/index"
import { UnitBody } from "./models/body"
import { UnitData } from "./models/unitData"
import { ItemManager } from "./modules/items"
import { ModifierManager } from "./modules/modifiers"
import { SpellManager } from "./modules/spells"
import { MountCooldownPreview } from "./preview"

new (class CCooldowns {
	private readonly menu = new MenuManager()
	private readonly itemManager = new ItemManager(this.menu)
	private readonly spellManager = new SpellManager(this.menu)
	private readonly modifierManager = new ModifierManager(this.menu)
	private readonly units: UnitData[] = []
	/**
	 * The units that have something on screen this frame, in the order they are drawn: kept
	 * between frames so a frame fills it rather than mints it, and read only up to the count the
	 * frame put in - the slots past it are left from an earlier frame.
	 */
	private readonly drawn: UnitData[] = []
	private readonly cachedUnits = new WeakSet<Unit>()

	constructor() {
		MountCooldownPreview(this.menu)
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
			Dota2SDK.GameRules === undefined ||
			Dota2SDK.GameRules.GameState === DOTAGameState.DOTA_GAMERULES_STATE_POST_GAME
		)
	}
	private get isUIGame() {
		return GameState.UIState === DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME
	}
	protected Draw() {
		surface.Begin()
		try {
			if (
				!this.state ||
				this.isPostGame ||
				!this.isUIGame ||
				!MenuSDK.HostCanDrawOverlays()
			) {
				return
			}
			UnitBody.BeginFrame()
			if (!UnitData.BeginFrame(this.menu)) {
				return
			}
			// every unit is asked whether it has anything on screen, and only those that do are put
			// in order and drawn: most of the units carried stand off screen most of the time
			const units = this.units,
				drawn = this.drawn
			let count = 0
			for (let i = 0, end = units.length; i < end; i++) {
				const unit = units[i]
				if (unit.Prepare()) {
					drawn[count++] = unit
				}
			}
			if (count > 1) {
				this.order(count)
			}
			// the farthest from the cursor first, so the nearest stands over the strips it overlaps
			for (let i = count - 1; i > -1; i--) {
				drawn[i].Draw(this.menu)
			}
		} finally {
			surface.End()
		}
	}
	protected EntityCreated(entity: Entity) {
		if (this.shouldBeUnit(entity)) {
			this.updateAllManagers(entity)
		}
	}
	protected EntityDestroyed(entity: Entity) {
		if (entity instanceof Ability) {
			for (const unit of this.units) {
				unit.EntityDestroyed(entity)
			}
		}
		if (this.isUnit(entity) && this.cachedUnits.has(entity)) {
			this.units.find(unit => unit.Owner === entity)?.DisposeAll()
			this.units.removeCallback(x => x.Owner === entity)
			this.cachedUnits.delete(entity)
		}
	}
	protected UnitPropertyChanged(entity: Unit) {
		if (!this.cachedUnits.has(entity)) {
			return
		}
		const getUnitData = this.units.find(x => x.Owner === entity)
		if (this.isSpiritBear(entity) && !entity.ShouldRespawn) {
			getUnitData?.DisposeAll()
			this.cachedUnits.delete(entity)
			this.units.removeCallback(x => x.Owner === entity)
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
		if (!this.shouldBeUnit(owner)) {
			return
		}
		if (this.modifierManager.State(owner)) {
			this.getOrAddUnitData(owner)?.ModifierRemoved(
				modifier,
				this.menu.ModifierMenu
			)
		}
	}
	private getOrAddUnitData(entity: Unit) {
		if (!entity.IsValid || this.isIllusion(entity)) {
			this.units.find(x => x.Owner === entity)?.DisposeAll()
			this.units.removeCallback(x => x.Owner === entity)
			this.cachedUnits.delete(entity)
			return
		}
		let getUnitData = this.units.find(x => x.Owner === entity)
		if (getUnitData === undefined) {
			getUnitData = new UnitData(entity)
			this.units.push(getUnitData)
			this.cachedUnits.add(entity)
			return getUnitData
		}
		return getUnitData
	}
	/**
	 * Puts the first `count` units to be drawn in order of how near the cursor they stand, the
	 * nearest first. Only the order of strips that overlap rides on it, so it is taken only when
	 * there are two units or more to draw; they are a handful at most, which an insertion sort
	 * settles in place, keeping units that tie in the order they were found.
	 */
	private order(count: number) {
		const drawn = this.drawn
		for (let i = 0; i < count; i++) {
			drawn[i].UpdatePriority()
		}
		for (let i = 1; i < count; i++) {
			const unit = drawn[i],
				priority = unit.Priority
			let j = i - 1
			for (; j > -1 && drawn[j].Priority > priority; j--) {
				drawn[j + 1] = drawn[j]
			}
			drawn[j + 1] = unit
		}
	}
	private shouldBeUnit(entity: Nullable<Entity>): entity is Unit {
		if (!this.isUnit(entity) || this.isIllusion(entity)) {
			return false
		}
		if (entity.IsHero || entity.IsRoshan || entity.IsCourier) {
			return true
		}
		if (this.isSpiritBear(entity)) {
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
	private isIllusion(unit: Unit) {
		return unit.IsIllusion && !unit.IsStrongIllusion
	}
	private isUnit(entity: Nullable<Entity>): entity is Unit {
		return entity?.IsUnit ?? false
	}
	private isSpiritBear(unit: Unit): unit is SpiritBear {
		return unit.IsSpiritBear
	}
})()
