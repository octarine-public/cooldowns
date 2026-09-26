import { ETextEffect } from "../gui/types"

export class TextStyleMenu {
	public readonly Node: Menu.Node
	public readonly Override: Nullable<Menu.Toggle>
	public readonly Font: Menu.Dropdown
	public readonly Size: Menu.Slider
	public readonly Weight: Menu.Dropdown
	public readonly Color: Menu.ColorPicker
	public readonly Effect: Menu.Dropdown
	public readonly EffectColor: Menu.ColorPicker
	public readonly EffectOpacity: Menu.Slider

	private readonly families = MenuSDK.MenuFontFamilies()
	private readonly weights = [400, 500, 600, 700]

	constructor(
		parent: Menu.Node,
		private readonly shared?: TextStyleMenu
	) {
		const node =
			shared === undefined
				? parent.AddNode("Style", Menu.Icons.Type)
				: parent.AddSettings("Text settings", Menu.Icons.Type)
		this.Node = node
		node.SortNodes = false
		if (shared !== undefined) {
			this.Override = node.AddToggle(
				"Override",
				false,
				"Use separate text settings for this element"
			)
		}
		this.Font = node.AddDropdown("Font", ["Default", ...this.families])
		this.Font.IconPath = Menu.Icons.Type
		this.Size = node.AddSlider(
			"Text size",
			90,
			70,
			150,
			0,
			"Scales cooldowns, charges and counters relative to their icon size"
		)
		this.Size.Suffix = "%"
		this.Size.IconPath = Menu.Icons.TextSize
		this.Weight = node.AddDropdown(
			"Weight",
			["Regular", "Medium", "Semi-bold", "Bold"],
			3
		)
		this.Weight.IconPath = Menu.Icons.Type
		this.Color = node.AddColorPicker("Text color", Color.White).SolidOnly()
		this.Color.IconPath = Menu.Icons.Palette
		this.Effect = node.AddDropdown(
			"Under text",
			["None", "Shadow", "Outline", "Soft shadow"],
			ETextEffect.Outline
		)
		this.Effect.IconPath = Menu.Icons.TextDots
		this.EffectColor = node.AddColorPicker("Effect color", Color.Black).SolidOnly()
		this.EffectColor.IconPath = Menu.Icons.Palette
		this.EffectOpacity = node.AddSlider("Text shade opacity", 100, 0, 100)
		this.EffectOpacity.Suffix = "%"
		this.EffectOpacity.IconPath = Menu.Icons.Checkerboard
		const syncEffect = () => {
			const inherited = this.Override !== undefined && !this.Override.value
			this.Font.IsHidden = this.Size.IsHidden = this.Weight.IsHidden = inherited
			this.Color.IsHidden = this.Effect.IsHidden = inherited
			this.EffectColor.IsHidden = this.EffectOpacity.IsHidden =
				inherited || this.Effect.SelectedID === ETextEffect.None
			node.Update()
		}
		this.Effect.OnValue(syncEffect)
		this.Override?.OnValue(syncEffect)
		syncEffect()
	}

	public get Effective(): TextStyleMenu {
		return this.shared !== undefined && !this.Override?.value ? this.shared : this
	}

	public get FontFamily(): string {
		return this.families[this.Font.SelectedID - 1] ?? MenuSDK.Theme.FontFamily
	}

	public get FontWeight(): number {
		return this.weights[this.Weight.SelectedID] ?? 700
	}
}
