import { CooldownIcons } from "./icons"
import { ItemMenu } from "./items"
import { ModifierMenu } from "./modifiers"
import { SpellMenu } from "./spells"
import { TextStyleMenu } from "./style"
import { MigrateTeamRow, StoredNode } from "./team"

export class MenuManager {
	public readonly General: Menu.Node
	public readonly State: Menu.Toggle
	public readonly Scale: Menu.Toggle
	public readonly OpacityByCursor: Menu.Toggle
	public readonly Animation: Menu.Toggle

	public readonly Opacity: Menu.Slider
	public readonly NoMana: Menu.Slider
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
			this.migrate(MenuSDK.ConfigSubtreeOf(raw, this.baseNode.entry))
		)
		this.migrate(this.baseNode.entry.stored)

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
		this.NoMana = general.AddSlider(
			"No mana brightness",
			80,
			0,
			100,
			0,
			"How bright an icon its owner cannot pay for is drawn:\n0 is the game's own dark wash, 100 keeps the icon\nas bright as it is"
		)
		this.NoMana.Suffix = "%"
		this.NoMana.IconPath = Menu.Icons.Lighting
		this.Animation = general.AddToggle(
			"Animation",
			true,
			"Bring a new spell, item or buff onto its strip\ninstead of switching it on: the cell fades in\nand is rung in, and its neighbours glide"
		)
		this.Animation.IconPath = Menu.Icons.Animation

		this.Style = new TextStyleMenu(this.baseNode)
		this.SpellMenu = new SpellMenu(
			this.baseNode,
			this.Style,
			this.Animation,
			this.NoMana
		)
		this.ItemMenu = new ItemMenu(
			this.baseNode,
			this.Style,
			this.Animation,
			this.NoMana
		)
		this.ModifierMenu = new ModifierMenu(
			this.baseNode,
			this.Style,
			this.Animation,
			this.NoMana
		)

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

	/** Every node that carried the team dropdown the multi-selects replaced, by its path. */
	private static readonly teamRows: readonly string[][] = [
		["Spells"],
		["Items"],
		["Modifiers"],
		["Modifiers", "Important"],
		["Modifiers", "Auras"],
		["Modifiers", "Buffs"],
		["Modifiers", "Debuffs"]
	]

	private migrate(stored: Nullable<MenuSDK.ConfigObject>) {
		this.migrateGeneralSettings(stored)
		for (const path of MenuManager.teamRows) {
			let node = stored
			for (const name of path) {
				node = node === undefined ? undefined : StoredNode(node[name])
			}
			MigrateTeamRow(node)
		}
	}

	private migrateGeneralSettings(stored: Nullable<MenuSDK.ConfigObject>) {
		const names = ["State", "Scale", "Opacity on hover", "Opacity", "Preview"]
		if (stored === undefined || !names.some(name => stored[name] !== undefined)) {
			return
		}
		const existing = stored.General
		if (existing !== undefined && StoredNode(existing) === undefined) {
			return
		}
		const general = StoredNode(existing) ?? {}
		for (const name of names) {
			if (stored[name] !== undefined) {
				general[name] ??= stored[name]
				delete stored[name]
			}
		}
		stored.General = general
	}
}
