// Original hud_healthbar_status_silenced sprites from Dota's healthbar_sheet textures.
// They are authored at twice the overhead HUD's reference size.
const labels: Record<string, { file: string; width: number }> = {
	english: { file: "silenced-en.png", width: 160 },
	russian: { file: "silenced-ru.png", width: 205 },
	chinese: { file: "silenced-cn.png", width: 126 }
}

export class PreviewSilence {
	private root: Nullable<HTMLElement>
	private label: Nullable<HTMLElement>
	private track: Nullable<HTMLElement>
	private fill: Nullable<HTMLElement>

	public readonly Ref = (element: HTMLElement | null | undefined): void => {
		if (this.label !== undefined) {
			MenuSDK.ReleaseSizedArt(this.label)
		}
		this.root = element ?? undefined
		this.label = this.track = this.fill = undefined
		if (this.root?.ownerDocument === undefined) {
			return
		}
		this.label = this.part("img")
		this.track = this.part("div")
		this.fill = this.part("div")
	}

	public Draw(visible: boolean, bar: Rectangle): void {
		const { root, label, track, fill } = this
		if (
			root === undefined ||
			label === undefined ||
			track === undefined ||
			fill === undefined
		) {
			return
		}
		MenuSDK.WriteShown(root, visible)
		if (!visible) {
			return
		}
		const pixel = GUIInfo.ScaleHeight(1)
		const art = labels[MenuSDK.Localization.SelectedUnitName] ?? labels.english
		const labelWidth = Math.round((art.width / 2) * pixel)
		const labelHeight = Math.round(15 * pixel)
		MenuSDK.WritePx(root, "left", bar.x)
		MenuSDK.WritePx(root, "top", bar.y - Math.round(33 * pixel))
		MenuSDK.WritePx(root, "width", bar.Width)
		MenuSDK.WritePx(root, "height", Math.round(29 * pixel))
		this.place(
			label,
			Math.round((bar.Width - labelWidth) / 2),
			0,
			labelWidth,
			labelHeight
		)
		MenuSDK.WriteSizedArt(
			label,
			`${__OCT_PACKAGE_ROOT__}/scripts_files/cooldowns/preview/${art.file}`,
			labelWidth,
			labelHeight
		)
		// A fixed remaining duration keeps the reference stable while arranging panels.
		this.place(track, -pixel, 22 * pixel, bar.Width + 2 * pixel, 7 * pixel)
		MenuSDK.WriteStyle(track, "background-color", "#37352fee")
		this.place(fill, 0, 23 * pixel, Math.round(bar.Width * 0.78), 5 * pixel)
		MenuSDK.WriteStyle(
			fill,
			"decorator",
			"linear-gradient(to bottom, #d6d4c9, #aaa89e)"
		)
	}

	private part(tag: string): Nullable<HTMLElement> {
		const root = this.root
		if (root?.ownerDocument === undefined) {
			return undefined
		}
		const element = root.ownerDocument.createElement(tag)
		MenuSDK.applyStyle(element, { position: "absolute", pointerEvents: "none" })
		root.appendChild(element)
		return element
	}

	private place(
		element: HTMLElement,
		x: number,
		y: number,
		w: number,
		h: number
	): void {
		MenuSDK.WritePx(element, "left", Math.round(x))
		MenuSDK.WritePx(element, "top", Math.round(y))
		MenuSDK.WritePx(element, "width", Math.round(x + w) - Math.round(x))
		MenuSDK.WritePx(element, "height", Math.round(y + h) - Math.round(y))
	}
}
