import { ETeamState } from "../enum"

/** The size the hero's level is set at, in design pixels, as the bars script sets it. */
const levelSize = 15
/**
 * Dota Hypatia Bold, per em: the face rises 0.734 over its baseline and falls 0.266 under it,
 * while the hinted digits reach two thirds of the size up, standing on the baseline.
 */
const levelRise = 0.734
const levelFall = 0.266
const levelDigitHeight = 2 / 3

/**
 * How far the level box drops, in whole screen pixels, to stand its digits in the middle of it:
 * a line centres the rise-plus-fall block, the digits fill only the top of it, and the box drops
 * by half of what is left under them. Read off the pixels the face is set on rather than off the
 * em, because the renderer rounds the rise up and the fall down to whole pixels before it lays
 * the line out, as the bars script reads it.
 */
function levelDrop(sizePx: number): number {
	const rise = Math.ceil(levelRise * sizePx)
	const fall = Math.ceil(levelFall * sizePx)
	const digits = Math.round(levelDigitHeight * sizePx)
	return (fall - rise + digits) / 2
}

export class PreviewHealthBar {
	public readonly Bounds: MenuSDK.ScreenRect = { x: 0, y: 0, w: 0, h: 0 }
	private root: Nullable<HTMLElement>
	private icon: Nullable<HTMLElement>
	private readonly parts: HTMLElement[] = []
	private used = 0
	private fontLoaded = false

	public readonly Ref = (element: HTMLElement | null | undefined): void => {
		if (this.icon !== undefined) {
			MenuSDK.ReleaseSizedArt(this.icon)
			this.icon = undefined
		}
		this.root = element ?? undefined
		this.parts.length = 0
		if (
			this.root !== undefined &&
			!this.fontLoaded &&
			typeof LoadFont === "function"
		) {
			this.fontLoaded = LoadFont(
				`${__OCT_PACKAGE_ROOT__}/scripts_files/cooldowns/fonts/dotahypatiasansprobold.ttf`,
				false,
				800
			)
		}
	}

	public Layout(bar: Rectangle, hero: boolean): void {
		const pixel = GUIInfo.ScaleHeight(1)
		Object.assign(this.Bounds, {
			x: Math.round(bar.x - pixel * (hero ? 28 : 2)),
			y: Math.round(bar.y - pixel * (hero ? 6 : 3)),
			w: Math.round(bar.pos2.x + pixel * (hero ? 20 : 2)),
			h: Math.round(
				Math.max(bar.pos2.y + pixel * 9, bar.y + pixel * (hero ? 20 : 0))
			)
		})
		this.Bounds.w -= this.Bounds.x
		this.Bounds.h -= this.Bounds.y
	}

	public Draw(visible: boolean, bar: Rectangle, team: ETeamState, hero: boolean): void {
		const root = this.root
		if (root === undefined) {
			return
		}
		MenuSDK.WriteShown(root, visible)
		if (!visible) {
			return
		}
		const pixel = GUIInfo.ScaleHeight(1)
		const width = bar.Width / pixel
		const height = bar.Height / pixel
		const x = (bar.x - this.Bounds.x) / pixel
		const y = (bar.y - this.Bounds.y) / pixel
		MenuSDK.WritePx(root, "left", this.Bounds.x)
		MenuSDK.WritePx(root, "top", this.Bounds.y)
		MenuSDK.WritePx(root, "width", this.Bounds.w)
		MenuSDK.WritePx(root, "height", this.Bounds.h)
		this.used = 0
		// Backing starts halfway under the icon: 2px above and 1px below the frame.
		this.part(
			x - (hero ? 16 : 2),
			y - 3,
			width + (hero ? 36 : 4),
			height + 11,
			"#381A19"
		)
		// Keep fade slots stable across unit changes and draw them below the bars.
		const fadeWidth = 1 + 17 / 2
		this.edgeFade(x - 1, y - 3, height + 11, fadeWidth, hero)
		this.edgeFade(x + width + 1, y - 3, height + 11, fadeWidth, hero)
		// 1px black above HP, 1px between bars, and 2px below the 4px mana bar.
		this.part(x - 1, y - 1, width + 2, height + 8, "#000000")
		const health = this.part(x, y, width, height, "#00000000")
		if (health !== undefined) {
			MenuSDK.WriteStyle(
				health,
				"decorator",
				team === ETeamState.Enemy
					? "linear-gradient(to bottom, #BE3308, #B22A00)"
					: "linear-gradient(to bottom, #89d153, #80c94a)"
			)
		}
		for (let index = 1; index < 5; index++) {
			this.part(x + Math.round((width * index) / 5), y, 2, height, "#35120750")
		}
		this.part(x, y + height + 1, width, 4, "#000000")
		this.part(x, y + height + 1, Math.round(width * 0.35), 4, "#4F78FA")
		// Shade the first mana row over its flat fill, keeping the separator above it.
		this.part(x, y + height + 1, width, 1, "#00000080")
		if (hero) {
			const levelSizePx = Math.round(pixel * levelSize)
			const levelTop = y - 1 + levelDrop(levelSizePx) / pixel
			const levelHeight = height + 8
			const level = this.part(x + width + 2, levelTop, 17, levelHeight, "#00000000")
			if (level !== undefined) {
				MenuSDK.WriteText(level, "7")
				MenuSDK.WriteStyle(level, "color", "#e8e6e3")
				// Dota's resource/clientscheme.res: UnitInfoPlayerLevelFont.
				MenuSDK.WriteStyle(level, "font-family", "Dota Hypatia Bold")
				MenuSDK.WriteStyle(level, "font-weight", "800")
				MenuSDK.WriteStyle(level, "text-align", "center")
				MenuSDK.WriteStyle(level, "font-effect", "outline(1px #000000)")
				MenuSDK.WritePx(level, "font-size", levelSizePx)
				// the line is the box, rounded edge by edge the way the box itself is
				MenuSDK.WritePx(
					level,
					"line-height",
					Math.round((levelTop + levelHeight) * pixel) -
						Math.round(levelTop * pixel)
				)
			}
			this.icon = this.part(x - 28, y - 6, 26, 26, "#00000000", "img")
			if (this.icon !== undefined) {
				MenuSDK.WriteSizedArt(
					this.icon,
					`${PathData.HeroIconsPath}/npc_dota_hero_void_spirit_png.vtex_c`,
					Math.round(pixel * 26),
					Math.round(pixel * 26)
				)
			}
		}
		for (let index = this.used; index < this.parts.length; index++) {
			MenuSDK.WriteShown(this.parts[index], false)
		}
	}

	private edgeFade(
		x: number,
		y: number,
		height: number,
		width: number,
		visible: boolean
	): void {
		const fade = this.part(x - width, y, width * 2, height, "#00000000")
		if (fade !== undefined) {
			MenuSDK.WriteShown(fade, visible)
			MenuSDK.WriteStyle(
				fade,
				"decorator",
				"linear-gradient(to right, #00000000, #00000050 50%, #00000000)"
			)
		}
	}

	private part(x: number, y: number, w: number, h: number, color: string, tag = "div") {
		const root = this.root
		if (root?.ownerDocument === undefined) {
			return undefined
		}
		let element = this.parts[this.used++]
		if (element === undefined) {
			element = root.ownerDocument.createElement(tag)
			MenuSDK.applyStyle(element, { position: "absolute", pointerEvents: "none" })
			root.appendChild(element)
			this.parts.push(element)
		}
		const pixel = GUIInfo.ScaleHeight(1)
		const left = Math.round(x * pixel)
		const top = Math.round(y * pixel)
		MenuSDK.WritePx(element, "left", left)
		MenuSDK.WritePx(element, "top", top)
		MenuSDK.WritePx(element, "width", Math.round((x + w) * pixel) - left)
		MenuSDK.WritePx(element, "height", Math.round((y + h) * pixel) - top)
		MenuSDK.WriteStyle(element, "background-color", color)
		MenuSDK.WriteShown(element, true)
		return element
	}
}
