import { HudCanvas } from "../gui/canvas"
import { BaseGUI } from "../gui/index"
import { BaseMenu } from "../menu/base"
import { BaseSettingsMenu } from "../menu/settings"

export class PreviewGroup {
	public readonly Canvas = new HudCanvas()
	public Area: Nullable<HTMLElement>
	public Hovered = false
	public Dragging = false
	public readonly AreaRef = (element: HTMLElement | null | undefined): void => {
		this.Area = element ?? undefined
		if (this.Area === undefined) {
			this.Hovered = false
		}
	}

	constructor(
		public readonly Label: string,
		public readonly Icon: string,
		public readonly Menu: BaseMenu,
		private readonly units: readonly (BaseSettingsMenu | undefined)[],
		private readonly unit: () => number,
		public readonly Sections: readonly Menu.Node[] = []
	) {}

	public get Settings(): Nullable<BaseSettingsMenu> {
		return this.units[this.unit()]
	}

	public Draw(
		gui: BaseGUI,
		bar: Rectangle,
		scale: number,
		visible: boolean,
		draw: (settings: BaseSettingsMenu) => void
	): void {
		this.Canvas.Begin()
		const settings = this.Settings
		if (
			visible &&
			settings !== undefined &&
			settings.State.value &&
			this.Menu.State.value
		) {
			gui.Update(bar.pos1, undefined, bar.Size, this.Menu.Size.value, scale)
			draw(settings)
		}
		this.Canvas.End()
		this.UpdateArea()
	}

	public UpdateArea(): void {
		const area = this.Area
		if (area === undefined) {
			return
		}
		const bounds = this.Canvas.Bounds
		const visible = Number.isFinite(bounds.x) && bounds.w > 0 && bounds.h > 0
		MenuSDK.WriteShown(area, visible)
		if (!visible) {
			return
		}
		const pad = MenuSDK.DpToPx(3)
		MenuSDK.WritePx(area, "left", bounds.x - pad)
		MenuSDK.WritePx(area, "top", bounds.y - pad)
		MenuSDK.WritePx(area, "width", bounds.w + pad * 2)
		MenuSDK.WritePx(area, "height", bounds.h + pad * 2)
		const selected = MenuSDK.ElementSettingsNode() === this.Menu.Tree
		MenuSDK.WriteStyle(
			area,
			"decorator",
			this.Hovered || this.Dragging || selected
				? (MenuSDK.SdfShape(
						3,
						"#00000000",
						1,
						MenuSDK.HexOf(MenuSDK.Tokens.Accent)
					).decorator ?? "none")
				: "none"
		)
	}
}
