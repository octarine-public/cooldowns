import {
	Modifier,
	npc_dota_brewmaster_earth,
	npc_dota_brewmaster_storm,
	npc_dota_brewmaster_void,
	npc_dota_visage_familiar,
	Unit,
	Utils
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "../menu/index"

interface IModifierData {
	ignoreList: string[]
	checkStateList: string[]
}

export class ModifierManager {
	// full ignore modifier name list
	private readonly ignoreList = new Set<string>()
	// check by stack count changed
	private readonly checkStateList = new Set<string>()
	// ignore ends with modifier name
	private readonly ignoreByEnds: string[] = [
		"_aura",
		"_stack",
		"_counter",
		"_pull",
		"_push",
		"_tooltip",
		"_fade"
	]

	constructor(private readonly menu: MenuManager) {
		this.InitData()
	}

	public StateByMenu(entity: Nullable<Unit>) {
		if (entity === undefined) {
			return false
		}
		if (entity.IsIllusion && !entity.IsStrongIllusion) {
			return false
		}
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

	public ShouldBeValid(owner: Nullable<Unit>, modifier: Modifier) {
		return this.StateByMenu(owner) && this.shouldBeValid(modifier)
	}

	public Get(owner: Nullable<Unit>) {
		if (owner === undefined || !this.StateByMenu(owner)) {
			return []
		}
		return owner.Buffs.filter(modifier => this.shouldBeValid(modifier))
	}

	private shouldBeValid(modifier: Modifier) {
		if (!modifier.IsValid || modifier.IsAura) {
			return false
		}
		if (modifier.GetTexturePath().length === 0) {
			return false
		}
		if (this.ignoreList.has(modifier.Name)) {
			return false
		}
		if (this.checkStateList.has(modifier.Name)) {
			return modifier.StackCount !== 0
		}
		if (this.isPostfix(modifier.Name)) {
			return false
		}
		return modifier.Duration !== -1
	}

	private isPostfix(modifierName: string) {
		return this.ignoreByEnds.some(endName => modifierName.endsWith(endName))
	}

	private InitData() {
		const { ignoreList, checkStateList } = this.getData()
		this.addToList(ignoreList, this.ignoreList)
		this.addToList(checkStateList, this.checkStateList)
	}

	private getData(): IModifierData {
		return Utils.readJSON("modifier_data.json")
	}

	private addToList(list: string[], hashSet: Set<string>) {
		for (let i = list.length - 1; i > -1; i--) {
			hashSet.add(list[i])
		}
	}
}
