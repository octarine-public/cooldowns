import { OpenGrayFrame, WashCopy, WashCopyHeld } from "./gray"
import { OpenRoundedFrame, RoundedArt } from "./rounded"
import { ETextEffect, GuiCanvas, HudImageStyle, StyledText, TextSurface } from "./types"

/**
 * A pooled element and the strings last derived for it. They ride the slot, which is minted with
 * its element and dropped with it, so a frame drawing the same shape or reading into the same
 * element builds none of them again while a fresh element still pays for its own first writes.
 */
interface Slot {
	readonly element: HTMLElement
	readonly art?: HTMLElement
	/** The image a washed icon is shown in: a grayed copy of the art, coloured by its tint. */
	readonly gray?: HTMLElement
	/** The source that copy was last pointed at. */
	graySource?: string
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
	/** The box, stacking order and visibility last written, so a frame that holds still writes none of them. */
	left?: number
	top?: number
	width?: number
	height?: number
	order?: number
	shown?: boolean
	/** Whether the styles every element of its kind wears unchanged have been written. */
	fixed?: boolean
	/**
	 * What an icon was last drawn from, and whether what it drew is final: a settled icon drawn
	 * from the same inputs again has nothing left to write. One still waiting on the host - a
	 * source not yet measured, a washed copy not yet cut - is never settled and is redone.
	 */
	path?: string
	washSource?: string
	wash?: object
	grayscale?: boolean
	settled?: boolean
	/** The reading last written, and the numbers it was set in. */
	text?: string
	size?: number
	lineHeight?: number
	opacity?: number
	align?: string
}

/**
 * Pooled elements under one parent and how many of each the frame has drawn: the overlay's root,
 * or the container of one strip. An element's box is written against the layer's origin, which
 * for the root is the screen's corner, and its stacking order counts from nought in each layer.
 */
class Layer {
	public readonly shapes: Slot[] = []
	public readonly strips: Slot[] = []
	public readonly images: Slot[] = []
	public readonly texts: Slot[] = []
	public shapeCount = 0
	public stripCount = 0
	public imageCount = 0
	public textCount = 0
	/** The stacking order the next element drawn into the layer takes. */
	public order = 0
	/** Where the layer's corner stands on the screen, in whole pixels. */
	public originX = 0
	public originY = 0
	/**
	 * The box everything drawn into a group since it was opened stands in, counted from its
	 * origin: what a group held over a frame adds to the bounds, and how near the cursor its
	 * strip stands. Empty while its left edge stands right of its right one.
	 */
	public boxLeft = Infinity
	public boxTop = Infinity
	public boxRight = -Infinity
	public boxBottom = -Infinity

	constructor(public readonly parent: Nullable<HTMLElement>) {}

	public Reset(): void {
		this.shapeCount =
			this.stripCount =
			this.imageCount =
			this.textCount =
			this.order =
				0
		this.boxLeft = this.boxTop = Infinity
		this.boxRight = this.boxBottom = -Infinity
	}

	/** Hides every element the frame did not draw into. */
	public HideUnused(): void {
		Layer.hide(this.shapes, this.shapeCount)
		Layer.hide(this.strips, this.stripCount)
		Layer.hide(this.images, this.imageCount)
		Layer.hide(this.texts, this.textCount)
	}

	/** Hands the art every icon of the layer holds back to the host. */
	public ReleaseArt(): void {
		for (const slot of this.images) {
			if (slot.art !== undefined) {
				MenuSDK.ReleaseSizedArt(slot.art)
			}
		}
	}

	private static hide(pool: Slot[], used: number): void {
		for (let index = used; index < pool.length; index++) {
			const slot = pool[index]
			if (slot.shown !== false) {
				slot.shown = false
				MenuSDK.WriteShown(slot.element, false)
			}
		}
	}
}

/**
 * One strip's layer: a container standing at the strip's origin, holding the strip's elements
 * at boxes counted from there. A strip that only moves - its unit walking, the camera panning -
 * writes the container's corner and nothing of what it holds, and a strip keeps its elements
 * whatever the strips drawn before it did this frame.
 */
class Group extends Layer {
	/** The corner, stacking order and visibility last written to the container. */
	public left?: number
	public top?: number
	public stack?: number
	public shown?: boolean
	/** The frame the strip was last drawn in, and the time of the last frame it was drawn in. */
	public frame = -1
	public seen = 0
	/** Whether the container has been let go of: a strip drawn again after that gets a new one. */
	public released = false
	/**
	 * Whether the strip's last drawing ran to {@link HudCanvas.EndGroup}, and whether this frame
	 * holds that drawing rather than making a new one, see {@link HudCanvas.KeepGroup}.
	 */
	public complete = false
	public kept = false
	/** The layout scale it was last drawn at, and the count of elements the host had freed by then. */
	public layoutUnit = 0
	public freed = 0

	constructor(
		public readonly container: HTMLElement,
		public readonly host: HTMLElement
	) {
		super(container)
	}

	/** Gives the container and everything in it back: the art to the host, the elements to the destroy queue. */
	public Release(): void {
		this.released = true
		this.ReleaseArt()
		MenuSDK.deferDestroy(this.container, this.host)
	}
}

export class HudCanvas implements GuiCanvas, TextSurface {
	/** How far a strip of an arc may stand off the circle it follows, in pixels: a fifth keeps a ring round on the smallest icons. */
	private static readonly chordSag = 0.15
	/**
	 * How long a strip may go undrawn before its container is let go of, in milliseconds: long
	 * enough that a unit stepping into the fog or the camera glancing away keeps its elements,
	 * short enough that the strips of units gone for good do not pile up.
	 */
	private static readonly releaseAfter = 10000
	private static readonly naturals = new Map<string, [number, number]>()
	private static readonly cover: [number, number] = [0, 0]
	public readonly Bounds: MenuSDK.ScreenRect = { x: 0, y: 0, w: 0, h: 0 }
	private root: Nullable<HTMLElement>
	/** The root's document, read once a frame: the native getter is too dear to ask per element. */
	private document: Nullable<HTMLDocument>
	/** What is drawn outside any strip's group, straight under the root. */
	private base = new Layer(undefined)
	/** The layer being drawn into: the base, or the group of the strip being drawn. */
	private layer: Layer = this.base
	/** The group being drawn into, if any. */
	private group: Nullable<Group>
	/**
	 * Each strip's group by its key. The map holds no key alive, and a group holds nothing of its
	 * key, so a strip whose unit is gone loses its entry here on its own; its container is let go
	 * of once it has gone undrawn long enough.
	 */
	private groups = new WeakMap<object, Group>()
	/** Every group with a container standing, in the order they were made. */
	private readonly live: Group[] = []
	private frame = 0
	/** Layout units per screen pixel, read once a frame: the scale behind it is two host reads. */
	private layoutUnit = 1
	/** How many times the host has freed elements without telling their holder, read once a frame. */
	private freed = 0

	/**
	 * `grouped` says strips get groups of their own, see {@link HudCanvas.BeginGroup}: the game's
	 * overlay, where dozens of strips move with their units and the camera. A canvas holding one
	 * strip that stands still, as each of the preview's does, gains nothing by it and draws
	 * everything straight under its root.
	 */
	constructor(private readonly grouped = false) {}

	public readonly Ref = (element: HTMLElement | null | undefined): void => {
		this.base.ReleaseArt()
		for (const group of this.live) {
			group.ReleaseArt()
		}
		this.live.length = 0
		this.groups = new WeakMap()
		this.root = element ?? undefined
		this.document = this.root?.ownerDocument ?? undefined
		this.base = this.layer = new Layer(this.root)
	}

	public Begin(): void {
		this.document = this.root?.ownerDocument ?? undefined
		this.layoutUnit = MenuSDK.ToLayoutUnits(1)
		if (this.grouped) {
			this.freed = MenuSDK.ElementsFreedEpoch()
		}
		OpenGrayFrame()
		OpenRoundedFrame()
		this.frame++
		this.base.Reset()
		this.layer = this.base
		this.group = undefined
		this.Bounds.x = this.Bounds.y = Infinity
		this.Bounds.w = this.Bounds.h = 0
	}

	public End(): void {
		this.layer = this.base
		this.group = undefined
		this.base.HideUnused()
		const live = this.live,
			frame = this.frame
		if (live.length === 0) {
			return
		}
		const now = Date.now()
		let kept = 0
		for (let index = 0; index < live.length; index++) {
			const group = live[index]
			if (group.frame === frame) {
				group.seen = now
				// a group held over the frame drew nothing, so nothing of it went unused
				if (!group.kept) {
					group.HideUnused()
				}
			} else {
				if (now - group.seen > HudCanvas.releaseAfter) {
					group.Release()
					continue
				}
				if (group.shown !== false) {
					group.shown = false
					// visibility is inherited, and the elements inside carry their own
					MenuSDK.WriteStyle(group.container, "display", "none")
				}
			}
			live[kept++] = group
		}
		live.length = kept
	}

	/**
	 * Draws what follows, up to {@link HudCanvas.EndGroup}, into the group of `key`: a container
	 * of its own standing at `x`, `y` - whole pixels, rounded if not - with pools of its own, so
	 * the strip keeps its elements from frame to frame whatever else is drawn. Calls inside take
	 * screen coordinates as ever; the canvas counts their boxes from the origin, and an element
	 * rounded onto the screen's pixels is rounded onto the container's alike. A strip laid out
	 * from that origin at fixed offsets writes nothing of its elements as it moves.
	 *
	 * Groups stack in the order they are first drawn in a frame, each over everything drawn
	 * before it. A group drawn again in the same frame goes on where it left off, at the origin
	 * it was opened at first. One not drawn in a frame is hidden at its end.
	 */
	public BeginGroup(key: object, x: number, y: number): void {
		const root = this.root,
			document = this.document
		if (!this.grouped || root === undefined || document === undefined) {
			return
		}
		let group = this.groups.get(key)
		if (group === undefined || group.released) {
			const container = document.createElement("div")
			MenuSDK.applyStyle(container, {
				position: "absolute",
				display: "none",
				pointerEvents: "none",
				backgroundColor: "transparent"
			})
			root.appendChild(container)
			group = new Group(container, root)
			group.seen = Date.now()
			this.groups.set(key, group)
			this.live.push(group)
		}
		this.layer = group
		this.group = group
		if (group.frame === this.frame) {
			return
		}
		group.frame = this.frame
		group.Reset()
		group.kept = group.complete = false
		group.layoutUnit = this.layoutUnit
		group.freed = this.freed
		this.stand(group, x, y)
	}

	/** Goes back to drawing straight under the root. */
	public EndGroup(): void {
		if (this.group !== undefined) {
			this.group.complete = true
			this.group = undefined
		}
		this.layer = this.base
	}

	/**
	 * Holds the group of `key` over this frame as the last one left it, standing at `x`, `y`
	 * instead: its corner and its place in the stack are written as {@link HudCanvas.BeginGroup}
	 * writes them, and nothing of what it holds is touched, drawn or hidden. Answers whether it
	 * could; where it could not, the caller draws the strip as ever.
	 *
	 * Only a drawing still standing whole can be held: one made or held the frame before this,
	 * run to its end, at this frame's layout scale, with no element freed behind the canvas's
	 * back since, and every icon in it final - none still waiting on the host for its size or
	 * its washed copy, none whose copy the cache has let go of since. A group hidden for a
	 * frame, or made again since the root was, has nothing standing to hold.
	 */
	public KeepGroup(key: object, x: number, y: number): boolean {
		if (!this.grouped || this.root === undefined) {
			return false
		}
		const group = this.groups.get(key)
		if (
			group === undefined ||
			group.released ||
			!group.complete ||
			group.frame !== this.frame - 1 ||
			group.shown !== true ||
			group.layoutUnit !== this.layoutUnit ||
			group.freed !== this.freed ||
			!HudCanvas.final(group)
		) {
			return false
		}
		group.frame = this.frame
		group.kept = true
		this.stand(group, x, y)
		if (group.boxLeft <= group.boxRight) {
			this.grow(
				group.originX + group.boxLeft,
				group.originY + group.boxTop,
				group.boxRight - group.boxLeft,
				group.boxBottom - group.boxTop
			)
		}
		return true
	}

	/**
	 * How far `point` stands from the box of what the group of `key` last drew, were it standing
	 * at `x`, `y`: nought from inside it, and for a group that has drawn nothing yet.
	 */
	public GroupDistance(key: object, x: number, y: number, point: Vector2): number {
		const group = this.grouped ? this.groups.get(key) : undefined
		if (group === undefined || !(group.boxLeft <= group.boxRight)) {
			return 0
		}
		const left = Math.round(x),
			top = Math.round(y)
		return Math.hypot(
			Math.max(left + group.boxLeft - point.x, point.x - left - group.boxRight, 0),
			Math.max(top + group.boxTop - point.y, point.y - top - group.boxBottom, 0)
		)
	}

	/** Whether every icon the group drew is final, see {@link HudCanvas.KeepGroup}. */
	private static final(group: Group): boolean {
		const images = group.images
		for (let index = 0; index < group.imageCount; index++) {
			const slot = images[index]
			if (
				slot?.settled !== true ||
				(slot.wash !== undefined && !WashCopyHeld(slot.graySource))
			) {
				return false
			}
		}
		return true
	}

	/** Stands the group's container at `x`, `y`, next in the stack, writing only what moved. */
	private stand(group: Group, x: number, y: number): void {
		const container = group.container,
			left = (group.originX = Math.round(x)),
			top = (group.originY = Math.round(y)),
			stack = this.base.order++
		if (group.left !== left) {
			group.left = left
			MenuSDK.WritePx(container, "left", left)
		}
		if (group.top !== top) {
			group.top = top
			MenuSDK.WritePx(container, "top", top)
		}
		if (group.stack !== stack) {
			group.stack = stack
			MenuSDK.WriteFmt(container, "z-index", stack, "")
		}
		if (group.shown !== true) {
			group.shown = true
			MenuSDK.WriteStyle(container, "display", "block")
		}
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
		const layer = this.layer
		const slot = this.slot(layer.shapes, layer.shapeCount++)
		if (slot === undefined) {
			return
		}
		const border = style.borderWidth ? Math.min(Math.max(style.borderWidth, 1), 2) : 0
		this.place(
			slot,
			position.x - border / 2 - 1,
			position.y - border / 2 - 1,
			size.x + border + 2,
			size.y + border + 2
		)
		const start = (style.start ?? -90) + 90 + (sweep < 0 ? sweep : 0)
		const fill = style.color ?? Color.WhiteReadonly
		const stroke = style.borderColor ?? Color.WhiteReadonly
		const radius = (style.radius ?? 0) * this.layoutUnit
		const width = border * this.layoutUnit
		const percent = Math.min(Math.abs(sweep) / 3.6, 100)
		const from = ((start % 360) + 360) % 360
		if (
			slot.decorator !== undefined &&
			slot.radius === radius &&
			slot.fill === fill.data32 &&
			slot.border === width &&
			slot.stroke === stroke.data32 &&
			slot.sweep === percent &&
			slot.start === from
		) {
			return
		}
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
	 * painted solid black. A round modifier is the SDK canvas's own timer wherever there is one;
	 * this is the ring of a surface without one.
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
		const layer = this.layer
		const slot = this.slot(layer.strips, layer.stripCount++)
		if (slot === undefined) {
			return
		}
		this.place(slot, x - length / 2, y - thickness / 2, length, thickness)
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
		style: HudImageStyle = {}
	): void {
		if (path === "" || size.x <= 0 || size.y <= 0) {
			return
		}
		const layer = this.layer
		const slot = this.slot(layer.images, layer.imageCount++, true)
		if (slot?.art === undefined) {
			return
		}
		const width = Math.max(Math.round(size.x), 1)
		const height = Math.max(Math.round(size.y), 1)
		const radius = style.circle ? Math.min(width, height) / 2 : (style.radius ?? 0)
		const wash = style.wash
		const color = style.color ?? Color.WhiteReadonly
		const grayscale = style.grayscale === true
		const resized = slot.width !== width || slot.height !== height
		this.place(slot, Math.round(position.x), Math.round(position.y), width, height)
		if (
			slot.settled === true &&
			!resized &&
			slot.path === path &&
			slot.radius === radius &&
			slot.wash === wash &&
			slot.washSource === style.washSource &&
			slot.fill === color.data32 &&
			slot.grayscale === grayscale &&
			// a settled washed icon shows its copy, which the cache may have dropped and freed since
			(wash === undefined || WashCopyHeld(slot.graySource))
		) {
			return
		}
		slot.path = path
		slot.radius = radius
		slot.wash = wash
		slot.washSource = style.washSource
		slot.fill = color.data32
		slot.grayscale = grayscale
		slot.settled = false
		const rounded =
			radius > 0 ? RoundedArt(path, width, height, radius, wash) : undefined
		if (slot.fixed !== true) {
			slot.fixed = true
			MenuSDK.WriteStyle(slot.element, "overflow", "hidden")
			MenuSDK.WriteStyle(slot.element, "clip", "always")
			// Rounded copies already carry antialiased coverage. A second rounded clip would
			// cut those partially transparent edge pixels back to a jagged stencil boundary.
			MenuSDK.WriteStyle(slot.element, "mask-image", "none")
		}
		MenuSDK.WritePx(
			slot.element,
			"border-radius",
			rounded !== undefined
				? 0
				: Math.max(0, Math.min(radius, Math.min(width, height) / 2))
		)
		const cover = HudCanvas.coverSize(path, width, height)
		const artWidth = rounded !== undefined ? width : cover[0]
		const artHeight = rounded !== undefined ? height : cover[1]
		// a washed icon is a copy of the art grayed and graded in the wash, cut to the same box;
		// while there is no copy yet, or none to be had, the art itself is tinted in the wash's
		// top colour, which is the wash of a gray icon and a darkening of a coloured one
		const gray =
			wash === undefined || rounded !== undefined
				? undefined
				: WashCopy(style.washSource ?? path, artWidth, artHeight, wash)
		const shown =
			gray !== undefined && slot.gray !== undefined && MenuSDK.HostImageReady(gray)
				? slot.gray
				: slot.art
		const hidden = shown === slot.art ? slot.gray : slot.art
		if (hidden !== undefined) {
			MenuSDK.WriteShown(hidden, false)
		}
		MenuSDK.WriteShown(shown, true)
		MenuSDK.WritePx(shown, "left", Math.round((width - artWidth) / 2))
		MenuSDK.WritePx(shown, "top", Math.round((height - artHeight) / 2))
		MenuSDK.WritePx(shown, "width", artWidth)
		MenuSDK.WritePx(shown, "height", artHeight)
		const tint =
			wash === undefined || shown === slot.gray || rounded !== undefined
				? color
				: wash.top.Clone().SetA(color.a)
		if (slot.tintStyle === undefined || slot.tint !== tint.data32) {
			slot.tint = tint.data32
			slot.tintStyle = MenuSDK.CssColor(tint)
		}
		MenuSDK.WriteStyle(shown, "image-color", slot.tintStyle)
		MenuSDK.WriteStyle(
			shown,
			"filter",
			grayscale && wash === undefined ? "grayscale(1)" : "none"
		)
		const measured = HudCanvas.naturals.has(path)
		if (gray !== undefined && shown === slot.gray) {
			if (slot.graySource !== gray) {
				slot.graySource = gray
				shown.setAttribute("src", gray)
			}
			slot.settled = radius <= 0 && measured
			return
		}
		MenuSDK.WriteSizedArt(slot.art, rounded ?? path, artWidth, artHeight)
		slot.settled = radius <= 0 && wash === undefined && measured
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
		const layer = this.layer
		const slot = this.slot(layer.texts, layer.textCount++)
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
		let restyled = false
		if (effect === undefined || filter === undefined || slot.effect !== shading) {
			restyled = true
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
			restyled = true
			slot.tint = command.color
			slot.tintStyle =
				color = `#${(command.color >>> 0).toString(16).padStart(8, "0")}`
		}
		this.place(slot, command.x, command.y, command.w, command.h)
		const lineHeight = command.lineHeight ?? command.h,
			textOpacity = command.opacity ?? 1
		if (
			!restyled &&
			slot.text === command.text &&
			slot.size === command.size &&
			slot.lineHeight === lineHeight &&
			slot.opacity === textOpacity &&
			slot.align === command.align &&
			slot.face === family &&
			slot.weight === weight &&
			slot.typography === effect
		) {
			return
		}
		slot.text = command.text
		slot.size = command.size
		slot.lineHeight = lineHeight
		slot.opacity = textOpacity
		slot.align = command.align
		if (slot.fixed !== true) {
			slot.fixed = true
			MenuSDK.WriteStyle(element, "white-space", "nowrap")
			MenuSDK.WriteStyle(element, "overflow", "visible")
		}
		MenuSDK.WritePx(element, "font-size", command.size)
		MenuSDK.WritePx(element, "line-height", lineHeight)
		MenuSDK.WriteStyle(element, "font-family", family)
		MenuSDK.WriteFmt(element, "font-weight", weight, "")
		MenuSDK.WriteStyle(element, "font-effect", effect)
		MenuSDK.WriteStyle(element, "filter", filter)
		MenuSDK.WriteStyle(element, "color", color)
		MenuSDK.WriteFmt(element, "opacity", textOpacity, "")
		MenuSDK.WriteStyle(element, "text-align", command.align)
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

	/** Slot `index` of a pool of the layer being drawn into, minted under its parent if it has none yet. */
	private slot(pool: Slot[], index: number, image = false): Nullable<Slot> {
		const parent = this.layer.parent,
			document = this.document
		if (parent === undefined || document === undefined) {
			return undefined
		}
		let slot = pool[index]
		if (slot === undefined) {
			const element = document.createElement("div")
			MenuSDK.applyStyle(element, {
				position: "absolute",
				display: "none",
				pointerEvents: "none",
				backgroundColor: "transparent"
			})
			parent.appendChild(element)
			const art = image ? document.createElement("img") : undefined
			const gray = image ? document.createElement("img") : undefined
			if (art !== undefined) {
				MenuSDK.applyStyle(art, { position: "absolute", pointerEvents: "none" })
				element.appendChild(art)
			}
			if (gray !== undefined) {
				MenuSDK.applyStyle(gray, {
					position: "absolute",
					display: "none",
					pointerEvents: "none"
				})
				element.appendChild(gray)
			}
			slot = { element, art, gray }
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
		const layer = this.layer
		if (layer !== this.base) {
			const left = x - layer.originX,
				top = y - layer.originY
			layer.boxLeft = Math.min(layer.boxLeft, left)
			layer.boxTop = Math.min(layer.boxTop, top)
			layer.boxRight = Math.max(layer.boxRight, left + width)
			layer.boxBottom = Math.max(layer.boxBottom, top + height)
		}
	}

	/**
	 * Writes the box an element stands in, on the screen at `x`, `y`, and its stacking order. The
	 * bounds count the box where it stands on the screen; the element is placed in its layer,
	 * whose origin is a whole pixel, so rounding there is rounding on the screen moved by it.
	 */
	private place(slot: Slot, x: number, y: number, width: number, height: number): void {
		this.grow(x, y, width, height)
		const layer = this.layer,
			element = slot.element,
			left = Math.round(x) - layer.originX,
			top = Math.round(y) - layer.originY,
			boxWidth = Math.round(width),
			boxHeight = Math.round(height),
			order = layer.order++
		if (slot.left !== left) {
			slot.left = left
			MenuSDK.WritePx(element, "left", left)
		}
		if (slot.top !== top) {
			slot.top = top
			MenuSDK.WritePx(element, "top", top)
		}
		if (slot.width !== boxWidth) {
			slot.width = boxWidth
			MenuSDK.WritePx(element, "width", boxWidth)
		}
		if (slot.height !== boxHeight) {
			slot.height = boxHeight
			MenuSDK.WritePx(element, "height", boxHeight)
		}
		if (slot.order !== order) {
			slot.order = order
			MenuSDK.WriteFmt(element, "z-index", order, "")
		}
		if (slot.shown !== true) {
			slot.shown = true
			MenuSDK.WriteShown(element, true)
		}
	}
}

/**
 * Readings pushed onto an SDK canvas's own surface, laid out the way the overlay lays them: the
 * same box, line and snapped left edge, unclipped. A round modifier's art and ring stand on that
 * canvas, and in the preview it stands over the card the overlay is drawn on, so a reading has
 * to go out on it too to be seen over its icon. The SDK's glyph effects are black and hard, so
 * the style's effect colour does not reach them and a soft shadow is cast as a plain one.
 */
export class SurfaceText implements TextSurface {
	constructor(private readonly surface: MenuSDK.CHudSurface) {}

	public Push(command: StyledText): void {
		this.surface.Push({
			kind: "text",
			// the surface clips a run that is not preformatted to its box, rim and all
			preformatted: true,
			x: command.x,
			y: command.y,
			w: command.w,
			h: command.h,
			lineHeight: command.lineHeight,
			align: command.align,
			text: command.text,
			size: command.size,
			weight: command.weight,
			family: command.family,
			color: command.color,
			opacity: command.opacity,
			effect:
				command.effect === ETextEffect.Shadow ||
				command.effect === ETextEffect.SoftShadow
					? MenuSDK.EHudTextEffect.Shadow
					: command.effect === ETextEffect.Outline
						? MenuSDK.EHudTextEffect.Outline
						: MenuSDK.EHudTextEffect.None,
			effectOpacity: command.effectOpacity
		})
	}
}
