import { PreviewGuide } from "./snap"

export class PreviewGuides {
	private root: Nullable<HTMLElement>
	private readonly lines: HTMLElement[] = []
	private used = 0
	public readonly Ref = (element: HTMLElement | null | undefined): void => {
		this.root = element ?? undefined
		this.lines.length = 0
	}

	public Draw(guides: readonly PreviewGuide[]): void {
		this.used = 0
		for (const guide of guides) {
			this.line(guide.x1, guide.y1, guide.x2, guide.y2)
			if (guide.spacing) {
				const tick = MenuSDK.DpToPx(3)
				const dx = guide.x1 === guide.x2 ? tick : 0
				const dy = guide.y1 === guide.y2 ? tick : 0
				this.line(guide.x1 - dx, guide.y1 - dy, guide.x1 + dx, guide.y1 + dy)
				this.line(guide.x2 - dx, guide.y2 - dy, guide.x2 + dx, guide.y2 + dy)
			}
		}
		for (let index = this.used; index < this.lines.length; index++) {
			MenuSDK.WriteShown(this.lines[index], false)
		}
	}

	private line(x1: number, y1: number, x2: number, y2: number): void {
		const root = this.root
		if (root?.ownerDocument === undefined) {
			return
		}
		let element = this.lines[this.used++]
		if (element === undefined) {
			element = root.ownerDocument.createElement("div")
			MenuSDK.applyStyle(element, { position: "absolute", pointerEvents: "none" })
			root.appendChild(element)
			this.lines.push(element)
		}
		MenuSDK.WritePx(element, "left", Math.round(Math.min(x1, x2)))
		MenuSDK.WritePx(element, "top", Math.round(Math.min(y1, y2)))
		MenuSDK.WritePx(element, "width", Math.max(1, Math.round(Math.abs(x2 - x1))))
		MenuSDK.WritePx(element, "height", Math.max(1, Math.round(Math.abs(y2 - y1))))
		MenuSDK.WriteStyle(
			element,
			"background-color",
			MenuSDK.HexOf(MenuSDK.Tokens.Accent)
		)
		MenuSDK.WriteShown(element, true)
	}
}
