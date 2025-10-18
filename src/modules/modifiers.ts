import {
	GameState,
	Modifier,
	npc_dota_brewmaster_earth,
	npc_dota_brewmaster_storm,
	npc_dota_brewmaster_void,
	npc_dota_visage_familiar,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "../enum"
import { MenuManager } from "../menu/index"
import { BaseModifierMenu } from "../menu/modifiers"

export class ModifierManager {
	private readonly ignoreModifiers = ["modifier_phased", "modifier_magic_immune"]

	constructor(private readonly menu: MenuManager) {}

	public Get(owner: Unit): Modifier[] {
		return this.State(owner)
			? owner.Buffs.filter(modifier => this.shouldBeValid(owner, modifier))
			: []
	}

	public State(entity: Unit) {
		const menu = this.menu.ModifierMenu
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
			case entity instanceof npc_dota_brewmaster_void ||
				entity instanceof npc_dota_brewmaster_storm ||
				entity instanceof npc_dota_brewmaster_earth:
				return menu.Pandas.State.value
			default:
				return false
		}
	}
	public ShouldBeValid(owner: Unit, modifier: Modifier) {
		return this.shouldBeValid(owner, modifier) && this.State(owner)
	}
	private shouldBeValid(owner: Unit, modifier: Modifier) {
		if (!modifier.IsValid || (modifier.IsHidden && !modifier.ForceVisible)) {
			return false
		}
		if (owner.IsCourier && this.ignoreModifiers.includes(modifier.Name)) {
			return false
		}
		if (modifier.ForceVisible) {
			return true
		}
		if (modifier.IsDisable() || modifier.IsShield() || modifier.IsChannel()) {
			return this.entityTeamState(owner, this.menu.ModifierMenu.Important)
		}
		if (modifier.IsAura) {
			return this.stateAuras(modifier)
		}
		if (modifier.IsBuff()) {
			return this.stateBuffs(modifier)
		}
		if (modifier.IsDebuff()) {
			return this.stateDebuffs(modifier)
		}
		return false
	}
	private stateAuras(modifier: Modifier) {
		const menu = this.menu.ModifierMenu.Auras
		if (modifier.IsGlobally && !menu.Globally.value) {
			return false
		}
		return !this.isDisabled(menu, modifier)
	}
	private stateBuffs(modifier: Modifier) {
		const menu = this.menu.ModifierMenu
		return !this.isDisabled(menu.Buffs, modifier)
	}
	private stateDebuffs(modifier: Modifier) {
		const menu = this.menu.ModifierMenu
		return !this.isDisabled(menu.Debuffs, modifier)
	}
	private isDisabled(menu: BaseModifierMenu, modifier: Modifier) {
		const owner = modifier.Parent
		if (owner === undefined || !this.entityTeamState(owner, menu)) {
			return true
		}
		const time = GameState.RawGameTime / 60
		return !menu.State.value || time >= menu.DisableByTme.value
	}
	private entityTeamState(entity: Unit, menu: BaseModifierMenu) {
		switch (menu.TeamState.SelectedID) {
			case ETeamState.All:
				return true
			case ETeamState.Ally:
				return !entity.IsEnemy() && !entity.IsMyHero
			case ETeamState.AllyAndLocal:
				return !entity.IsEnemy() || entity.IsMyHero
			case ETeamState.Enemy:
				return entity.IsEnemy()
			default:
				return false
		}
	}
}
