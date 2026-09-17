import { CooldownIcons } from "./icons"
import { ItemMenu } from "./items"
import { ModifierMenu } from "./modifiers"
import { SpellMenu } from "./spells"
import { TextStyleMenu } from "./style"

export class MenuManager {
	public readonly General: Menu.Node
	public readonly State: Menu.Toggle
	public readonly Scale: Menu.Toggle
	public readonly OpacityByCursor: Menu.Toggle

	public readonly Opacity: Menu.Slider
	public readonly Style: TextStyleMenu

	public readonly ItemMenu: ItemMenu
	public readonly SpellMenu: SpellMenu
	public readonly ModifierMenu: ModifierMenu

	private readonly baseNode: Menu.Node
	private readonly visual = Menu.AddEntry("Visual")

	constructor() {
		this.baseNode = this.visual.AddNode(
			"Cooldowns_v1",
			CooldownIcons.Cooldowns,
			"Displays cooldowns for spells and items"
		)
		this.baseNode.SortNodes = true
		this.baseNode.TabbedChildren = true
		MenuSDK.AddConfigMigration(raw =>
			this.migrateGeneralSettings(MenuSDK.ConfigSubtreeOf(raw, this.baseNode.entry))
		)
		this.migrateGeneralSettings(this.baseNode.entry.stored)

		const general = this.baseNode.AddNode("General", CooldownIcons.General)
		this.General = general
		general.SortNodes = false
		this.State = general.AddToggle("State", true)
		general.HeaderControl = this.State
		this.baseNode.HeaderControl = this.State
		this.baseNode.Gate = this.State
		this.Scale = general.AddToggle(
			"Scale",
			false,
			"Scales abilities, items and modifiers\nnear the mouse"
		)
		this.Scale.IconPath = Menu.Icons.Maximize2
		this.OpacityByCursor = general.AddToggle(
			"Opacity on hover",
			true,
			"Opacity abilities, items and modifiers\nnear the mouse"
		)
		this.OpacityByCursor.IconPath = Menu.Icons.HoverArrow
		this.Opacity = general.AddSlider("Opacity", 100, 40, 100)
		this.Opacity.IconPath = Menu.Icons.Checkerboard

		this.Style = new TextStyleMenu(this.baseNode)
		this.SpellMenu = new SpellMenu(this.baseNode, this.Style)
		this.ItemMenu = new ItemMenu(this.baseNode, this.Style)
		this.ModifierMenu = new ModifierMenu(this.baseNode, this.Style)

		const tabs = [
			general,
			this.SpellMenu.Tree,
			this.ItemMenu.Tree,
			this.ModifierMenu.Tree,
			this.Style.Node
		]
		tabs.forEach((tab, index) => (tab.Priority = index))
	}

	public MenuChnaged(callback: () => void) {
		this.ItemMenu.MenuChanged(callback)
		this.SpellMenu.MenuChanged(callback)
		this.ModifierMenu.MenuChanged(callback)
	}

	public get Node(): Menu.Node {
		return this.baseNode
	}

	private migrateGeneralSettings(stored: Nullable<MenuSDK.ConfigObject>) {
		const names = ["State", "Scale", "Opacity on hover", "Opacity", "Preview"]
		if (stored === undefined || !names.some(name => stored[name] !== undefined)) {
			return
		}
		const existing = stored.General
		if (
			existing !== undefined &&
			(typeof existing !== "object" || existing === null || Array.isArray(existing))
		) {
			return
		}
		const general = (existing ?? {}) as MenuSDK.ConfigObject
		for (const name of names) {
			if (stored[name] !== undefined) {
				general[name] ??= stored[name]
				delete stored[name]
			}
		}
		stored.General = general
	}
}
