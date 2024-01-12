import { Menu } from "github.com/octarine-public/wrapper/index"

import { ItemMenu } from "./items"
import { SpellMenu } from "./spells"

export class MenuManager {
	public readonly State: Menu.Toggle
	public readonly ItemMenu: ItemMenu
	public readonly SpellMenu: SpellMenu

	private readonly visual = Menu.AddEntry("Visual")
	private readonly baseNode: Menu.Node

	constructor() {
		this.baseNode = this.visual.AddNode(
			"Cooldowns",
			"panorama/images/hud/reborn/icon_attack_speed2_psd.vtex_c"
		)

		this.baseNode.SortNodes = false
		this.State = this.baseNode.AddToggle("State", true)

		this.ItemMenu = new ItemMenu(this.baseNode)
		this.SpellMenu = new SpellMenu(this.baseNode)
	}
}
