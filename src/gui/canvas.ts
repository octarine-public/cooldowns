import { ETextEffect, GuiCanvas, StyledText, TextSurface } from "./types"

/**
 * A pooled element and the strings last derived for it. They ride the slot, which is minted with
 * its element and dropped with it, so a frame drawing the same shape or reading into the same
 * element builds none of them again while a fresh element still pays for its own first writes.
 */
interface Slot {
	readonly element: HTMLElement
	readonly art?: HTMLElement
	/** The shader fragment the element last carried, and the numbers it was built from. */
	decorator?: string
	radius?: number
	fill?: number
	border?: number
	stroke?: number
	sweep?: number
	start?: number
	/** The colour the element, or the art inside it, was last painted in. */
	tint?: number
	tintStyle?: string
	/** The glyph effect a reading was last drawn with, and the face it was set in. */
	effect?: number
	effectStyle?: string
	filterStyle?: string
	face?: string
	weight?: number
	typography?: string
}

export class HudCanvas implements GuiCanvas, TextSurface {
	/** How far a strip of an arc may stand off the circle it follows, in pixels: a fifth keeps a ring round on the smallest icons. */
	private static readonly chordSag = 0.15
	private static readonly naturals = new Map<string, [number, number]>()
	private static readonly cover: [number, number] = [0, 0]
	public readonly Bounds: MenuSDK.ScreenRect = { x: 0, y: 0, w: 0, h: 0 }
	private root: Nullable<HTMLElement>
	private readonly shapes: Slot[] = []
	private readonly strips: Slot[] = []
	private readonly images: Slot[] = []
	private readonly texts: Slot[] = []
	private shapeCount = 0
	private stripCount = 0
	private imageCount = 0
	private textCount = 0
	private order = 0

	public readonly Ref = (element: HTMLElement | null | undefined): void => {
		for (const slot of this.images) {
			if (slot.art !== undefined) {
				MenuSDK.ReleaseSizedArt(slot.art)
			}
		}
		this.shapes.length =
			this.strips.length =
			this.images.length =
			this.texts.length =
				0
		this.root = element ?? undefined
	}

	public Begin(): void {
		this.shapeCount =
			this.stripCount =
			this.imageCount =
			this.textCount =
			this.order =
				0
		this.Bounds.x = this.Bounds.y = Infinity
		this.Bounds.w = this.Bounds.h = 0
	}

	public End(): void {
		this.hideUnused(this.shapes, this.shapeCount)
		this.hideUnused(this.strips, this.stripCount)
		this.hideUnused(this.images, this.imageCount)
		this.hideUnused(this.texts, this.textCount)
	}

	public Rect(
		position: Vector2,
		size: Vector2,
		style: MenuSDK.CanvasShapeStyle = {}
	): void {
		const sweep = style.sweep ?? 360
		if (size.x <= 0 || size.y <= 0 || sweep === 0) {
			return
		}
		const slot = this.slot(this.shapes, this.shapeCount++)
		if (slot === undefined) {
			return
		}
		const border = style.borderWidth ? Math.min(Math.max(style.borderWidth, 1), 2) : 0
		this.place(
			slot.element,
			position.x - border / 2 - 1,
			position.y - border / 2 - 1,
			size.x + border + 2,
			size.y + border + 2
		)
		const start = (style.start ?? -90) + 90 + (sweep < 0 ? sweep : 0)
		const fill = style.color ?? Color.WhiteReadonly
		const stroke = style.borderColor ?? Color.WhiteReadonly
		const radius = MenuSDK.ToLayoutUnits(style.radius ?? 0)
		const width = MenuSDK.ToLayoutUnits(border)
		const percent = Math.min(Math.abs(sweep) / 3.6, 100)
		const from = ((start % 360) + 360) % 360
		if (
			slot.decorator === undefined ||
			slot.radius !== radius ||
			slot.fill !== fill.data32 ||
			slot.border !== width ||
			slot.stroke !== stroke.data32 ||
			slot.sweep !== percent ||
			slot.start !== from
		) {
			slot.radius = radius
			slot.fill = fill.data32
			slot.border = width
			slot.stroke = stroke.data32
			slot.sweep = percent
			slot.start = from
			slot.decorator =
				MenuSDK.SdfShape(
					radius,
					MenuSDK.CssColor(fill),
					width,
					MenuSDK.CssColor(stroke),
					1,
					0,
					"",
					percent,
					from
				).decorator ?? "none"
		}
		MenuSDK.WriteStyle(slot.element, "decorator", slot.decorator)
	}

	public Circle(
		position: Vector2,
		size: Vector2,
		style: MenuSDK.CanvasShapeStyle = {}
	): void {
		this.Rect(position, size, { ...style, radius: 9999 })
	}

	/**
	 * A ring `thickness` pixels wide on the circle of that radius, running from `start` clockwise
	 * by `sweep`, both in degrees with twelve o'clock at -90 - the SDK canvas's arc, laid here as
	 * a chain of strips along the circle. The sdf circle's own sweep is no way to draw it: swept,
	 * a circle with a border and no fill comes out of this host with the inside of its ring
	 * painted solid black. In the game a round modifier is the SDK canvas's own timer instead;
	 * this is the preview's ring.
	 */
	public Arc(
		center: Vector2,
		radius: number,
		thickness: number,
		start: number,
		sweep: number,
		color: Color
	): void {
		if (!(radius > 0 && thickness > 0 && sweep > 0) || color.a <= 0) {
			return
		}
		const turn = (Math.min(sweep, 360) * Math.PI) / 180
		const step = 2 * Math.acos(Math.max(1 - HudCanvas.chordSag / radius, 0))
		const count = Math.max(Math.ceil(turn / step), 1)
		const each = turn / count
		const length = 2 * radius * Math.sin(each / 2) + thickness
		const fill = MenuSDK.CssColor(color)
		let angle = (start * Math.PI) / 180
		for (let index = 0; index < count; index++) {
			const middle = angle + each / 2
			this.strip(
				center.x + Math.cos(middle) * radius,
				center.y + Math.sin(middle) * radius,
				length,
				thickness,
				(middle * 180) / Math.PI + 90,
				fill
			)
			angle += each
		}
	}

	/** A strip `length` by `thickness` centred on a point and turned `angle` degrees about it. */
	private strip(
		x: number,
		y: number,
		length: number,
		thickness: number,
		angle: number,
		fill: string
	): void {
		const slot = this.slot(this.strips, this.stripCount++)
		if (slot === undefined) {
			return
		}
		this.place(slot.element, x - length / 2, y - thickness / 2, length, thickness)
		MenuSDK.WriteStyle(slot.element, "background-color", fill)
		MenuSDK.WriteStyle(
			slot.element,
			"transform",
			`rotate(${Math.round(angle * 10) / 10}deg)`
		)
	}

	/**
	 * Icons are bitmaps minted for the box they stand in, the way deadlock-esp draws its cells:
	 * the box lands on whole pixels and the art is cut straight to the box's size, so nothing is
	 * resampled a second time on the way to the screen. A source shaped like its box - a spell
	 * icon in a square cell, item art in its 11:8 cell - is cut to the box exactly; one of another
	 * shape covers the box at whole pixels and is cropped centred, the crop on a whole pixel too.
	 * Until the host has measured the source it is cut to the box, which for a matching shape is
	 * already the answer.
	 */
	public Image(
		path: string,
		position: Vector2,
		size: Vector2,
		style: MenuSDK.CanvasImageStyle = {}
	): void {
		if (path === "" || size.x <= 0 || size.y <= 0) {
			return
		}
		const slot = this.slot(this.images, this.imageCount++, true)
		if (slot?.art === undefined) {
			return
		}
		const width = Math.max(Math.round(size.x), 1)
		const height = Math.max(Math.round(size.y), 1)
		const radius = style.circle ? Math.min(width, height) / 2 : (style.radius ?? 0)
		this.place(
			slot.element,
			Math.round(position.x),
			Math.round(position.y),
			width,
			height
		)
		MenuSDK.WriteStyle(slot.element, "overflow", "hidden")
		MenuSDK.WriteStyle(slot.element, "clip", "always")
		const mask = radius > 0 ? MenuSDK.ToLayoutUnits(radius) : 0
		if (slot.decorator === undefined || slot.radius !== mask) {
			slot.radius = mask
			slot.decorator =
				mask > 0
					? (MenuSDK.SdfShape(mask, "#ffffffff").decorator ?? "none")
					: "none"
		}
		MenuSDK.WriteStyle(slot.element, "mask-image", slot.decorator)
		const cover = HudCanvas.coverSize(path, width, height)
		const artWidth = cover[0]
		const artHeight = cover[1]
		MenuSDK.WritePx(slot.art, "left", Math.round((width - artWidth) / 2))
		MenuSDK.WritePx(slot.art, "top", Math.round((height - artHeight) / 2))
		MenuSDK.WritePx(slot.art, "width", artWidth)
		MenuSDK.WritePx(slot.art, "height", artHeight)
		const tint = style.color ?? Color.WhiteReadonly
		if (slot.tintStyle === undefined || slot.tint !== tint.data32) {
			slot.tint = tint.data32
			slot.tintStyle = MenuSDK.CssColor(tint)
		}
		MenuSDK.WriteStyle(slot.art, "image-color", slot.tintStyle)
		MenuSDK.WriteStyle(slot.art, "filter", style.grayscale ? "grayscale(1)" : "none")
		MenuSDK.WriteSizedArt(slot.art, path, artWidth, artHeight)
	}

	/**
	 * The whole-pixel size a source is cut to for a box: the box itself where the source has the
	 * box's shape to within a pixel, otherwise the smallest whole-pixel cover of the box. The pair
	 * is the canvas's own scratch, read straight after the call and never kept.
	 */
	private static coverSize(
		path: string,
		width: number,
		height: number
	): [number, number] {
		const cover = HudCanvas.cover
		cover[0] = width
		cover[1] = height
		const natural = HudCanvas.naturalSize(path)
		if (natural === undefined) {
			return cover
		}
		const scale = Math.max(width / natural[0], height / natural[1])
		const artWidth = Math.max(Math.round(natural[0] * scale), width)
		const artHeight = Math.max(Math.round(natural[1] * scale), height)
		cover[0] = artWidth - width <= 1 ? width : artWidth
		cover[1] = artHeight - height <= 1 ? height : artHeight
		return cover
	}

	/**
	 * What the host says a source measures, kept per path: an asset's own size never changes, and
	 * a source the host has not measured yet is asked for again rather than remembered as missing.
	 */
	private static naturalSize(path: string): Nullable<[number, number]> {
		let natural = HudCanvas.naturals.get(path)
		if (natural === undefined) {
			const measured = MenuSDK.ImageSize(path)
			if (!(measured.x > 0 && measured.y > 0)) {
				return undefined
			}
			natural = [measured.x, measured.y]
			HudCanvas.naturals.set(path, natural)
		}
		return natural
	}

	public Push(command: StyledText): void {
		const slot = this.slot(this.texts, this.textCount++)
		if (slot === undefined) {
			return
		}
		const element = slot.element
		const family = command.family ?? MenuSDK.Theme.FontFamily
		const weight = MenuSDK.MenuFontWeight(command.weight)
		const opacity = Math.round(Math.clamp(command.effectOpacity ?? 1, 0, 1) * 20) / 20
		const shading =
			command.effectColor * 84 + Math.round(opacity * 20) * 4 + command.effect
		let effect = slot.effectStyle
		let filter = slot.filterStyle
		if (effect === undefined || filter === undefined || slot.effect !== shading) {
			slot.effect = shading
			const shade = `#${(command.effectColor >>> 8).toString(16).padStart(6, "0")}${Math.round(
				opacity * 255
			)
				.toString(16)
				.padStart(2, "0")}`
			slot.effectStyle = effect =
				command.effect === ETextEffect.Shadow
					? `shadow(1px 1px ${shade})`
					: command.effect === ETextEffect.Outline
						? `outline(1px ${shade})`
						: "none"
			slot.filterStyle = filter =
				command.effect === ETextEffect.SoftShadow && opacity > 0
					? `drop-shadow(${shade} 1px 1px 2px)`
					: "none"
		}
		let color = slot.tintStyle
		if (color === undefined || slot.tint !== command.color) {
			slot.tint = command.color
			slot.tintStyle =
				color = `#${(command.color >>> 0).toString(16).padStart(8, "0")}`
		}
		this.place(element, command.x, command.y, command.w, command.h)
		MenuSDK.WritePx(element, "font-size", command.size)
		MenuSDK.WritePx(element, "line-height", command.lineHeight ?? command.h)
		MenuSDK.WriteStyle(element, "font-family", family)
		MenuSDK.WriteFmt(element, "font-weight", weight, "")
		MenuSDK.WriteStyle(element, "font-effect", effect)
		MenuSDK.WriteStyle(element, "filter", filter)
		MenuSDK.WriteStyle(element, "color", color)
		MenuSDK.WriteFmt(element, "opacity", command.opacity ?? 1, "")
		MenuSDK.WriteStyle(element, "text-align", command.align)
		MenuSDK.WriteStyle(element, "white-space", "nowrap")
		MenuSDK.WriteStyle(element, "overflow", "visible")
		if (
			slot.face !== family ||
			slot.weight !== weight ||
			slot.typography !== effect
		) {
			slot.face = family
			slot.weight = weight
			slot.typography = effect
			MenuSDK.WriteText(element, "")
		}
		MenuSDK.WriteText(element, command.text)
	}

	private slot(pool: Slot[], index: number, image = false): Nullable<Slot> {
		const root = this.root
		if (root?.ownerDocument === undefined) {
			return undefined
		}
		let slot = pool[index]
		if (slot === undefined) {
			const element = root.ownerDocument.createElement("div")
			MenuSDK.applyStyle(element, {
				position: "absolute",
				display: "none",
				pointerEvents: "none",
				backgroundColor: "transparent"
			})
			root.appendChild(element)
			const art = image ? root.ownerDocument.createElement("img") : undefined
			if (art !== undefined) {
				MenuSDK.applyStyle(art, { position: "absolute", pointerEvents: "none" })
				element.appendChild(art)
			}
			slot = { element, art }
			pool.push(slot)
		}
		return slot
	}

	public Reserve(position: Vector2, size: Vector2): void {
		this.grow(position.x, position.y, size.x, size.y)
	}

	private grow(x: number, y: number, width: number, height: number): void {
		const right = Math.max(
			this.Bounds.x === Infinity ? x : this.Bounds.x + this.Bounds.w,
			x + width
		)
		const bottom = Math.max(
			this.Bounds.y === Infinity ? y : this.Bounds.y + this.Bounds.h,
			y + height
		)
		this.Bounds.x = Math.min(this.Bounds.x, x)
		this.Bounds.y = Math.min(this.Bounds.y, y)
		this.Bounds.w = right - this.Bounds.x
		this.Bounds.h = bottom - this.Bounds.y
	}

	private place(
		element: HTMLElement,
		x: number,
		y: number,
		width: number,
		height: number
	): void {
		this.grow(x, y, width, height)
		MenuSDK.WritePx(element, "left", Math.round(x))
		MenuSDK.WritePx(element, "top", Math.round(y))
		MenuSDK.WritePx(element, "width", Math.round(width))
		MenuSDK.WritePx(element, "height", Math.round(height))
		MenuSDK.WriteFmt(element, "z-index", this.order++, "")
		MenuSDK.WriteShown(element, true)
	}

	private hideUnused(pool: Slot[], used: number): void {
		for (let index = used; index < pool.length; index++) {
			MenuSDK.WriteShown(pool[index].element, false)
		}
	}
}
