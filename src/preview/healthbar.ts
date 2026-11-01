import { ETeamState } from "../enum"
import { EBarStyle, PreviewBar } from "./models"

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

type Rgb = readonly [r: number, g: number, b: number]

/**
 * The tints the game lays over its grey sprites, one per `dota_hud_colorblind` setting, as
 * client.dll keeps them (the tables from 0x184A0D770 on).
 */
const CREEP_ALLY: readonly Rgb[] = [
	[0x91, 0xff, 0x6b],
	[0x60, 0xba, 0xe7],
	[0xd2, 0xd2, 0x00]
]
const CREEP_ENEMY: readonly Rgb[] = [
	[0xe5, 0x83, 0x64],
	[0xff, 0x4d, 0x45],
	[0xe5, 0x83, 0x64]
]
/** A hero's health, and a summon's, unless it is your own hero's. */
const HERO_ALLY: readonly Rgb[] = [
	[0x83, 0xff, 0x3f],
	[0x6b, 0xcd, 0xff],
	[0xbe, 0xd2, 0x1e]
]
const HERO_LOCAL: readonly Rgb[] = [
	[0xb3, 0xfc, 0x66],
	[0x6b, 0xcd, 0xff],
	[0x6d, 0xe1, 0x3e]
]
const HERO_ENEMY: Rgb = [0xfb, 0x3f, 0x00]
const MANA: Rgb = [0x51, 0x7b, 0xff]
/** Roshan's, the same under every colorblind setting. */
const LARGE: Rgb = [0xff, 0x4b, 0x03]

/**
 * How bright each pixel row of a bar's fill is under its tint, top down, and how bright it is
 * across - darker toward both ends - as the game's sprites land on a 1080p screen. Read off its
 * frames rather than its sheet, so they carry its blending as well.
 */
const CREEP_ROWS = [0.595, 0.61, 0.565, 0.565, 0.565]
const CREEP_ACROSS: readonly [at: number, light: number][] = [
	[0, 0.85],
	[8, 0.89],
	[23, 0.955],
	[39, 1],
	[61, 1],
	[77, 0.955],
	[92, 0.89],
	[100, 0.85]
]
const LARGE_ROWS = [0.996, 0.855, 0.75, 0.63, 0.515, 0.4]
const LARGE_ACROSS: readonly [at: number, light: number][] = [
	[0, 0.8],
	[3, 0.83],
	[9, 0.865],
	[13, 0.9],
	[30, 1],
	[70, 1],
	[87, 0.9],
	[91, 0.865],
	[97, 0.83],
	[100, 0.8]
]
/** A hero's eight, which its sprite lights far brighter than a summon's. */
const HERO_ROWS = [0.904, 0.853, 0.82, 0.745, 0.733, 0.717, 0.709, 0.649]
/** Your own hero's, which the game draws from its bright sprite. */
const HERO_ROWS_SELF = [0.99, 0.985, 0.98, 0.975, 0.965, 0.94, 0.915, 0.88]
const SUMMON_ROWS = [0.61, 0.61, 0.57, 0.515, 0.505, 0.49]
const SUMMON_ROWS_NO_MANA = [0.64, 0.61, 0.58, 0.54, 0.52, 0.505, 0.49]
/** A courier's segment: dark at its edges and lit a little left of its middle. */
const PIP_ACROSS: readonly [at: number, light: number][] = [
	[0, 0.62],
	[46, 0.975],
	[100, 0.615]
]

/**
 * The grey frame the game draws around a summon you control (`tintable_controllable`), ring by
 * ring: the outer one lit on top, the inner one shaded.
 */
const OUTLINE_TOP = "#999898"
const OUTLINE_BOTTOM = "#868686"
const OUTLINE_LEFT = "#767876"
const OUTLINE_RIGHT = "#6c6e6c"
const OUTLINE_INNER_TOP = "#727672"
const OUTLINE_INNER_BOTTOM = "#3a3b3a"
const OUTLINE_INNER_LEFT = "#474947"
const OUTLINE_INNER_RIGHT = "#424442"
/**
 * The frame behind a hero's rows is tinted by side from convars (`dota_hud_new_healthbar_*`), and
 * lands this bright where most of it shows; a summon nobody here controls is framed in it too.
 */
const BACKING_LIGHT = 0.58
/** Those convars' defaults, for a host that cannot read them. */
const BACKING_DEFAULTS: Record<string, Rgb> = {
	enemy: [96, 48, 48],
	ally: [48, 80, 48],
	ally_cb: [107, 205, 255],
	local: [64, 128, 64]
}

/** A summon's health is marked every this much, every fourth mark darker. */
const DIVIDER_HEALTH = 250
/** The sprite a hero-like bar is stretched over, which its dividers are counted across. */
const SUMMON_SPRITE_WIDTH = 105

/** The courier's owner beside its bar, as the maphack script measured it. */
const PORTRAIT = 21
const PORTRAIT_GAP = 1
const PORTRAIT_RISE = 2
const PORTRAIT_RADIUS = 6
/** Each segment of a courier's bar, the border round them and the gap between them. */
const PIP_BORDER = 2
const PIP_SEGMENT = 12
const PIP_SEGMENT_HEIGHT = 3

/** Which colorblind setting the game draws its bars for, as an index into the tables above. */
function colorblind(): number {
	if (typeof ConVarsSDK === "undefined") {
		return 0
	}
	return Math.clamp(Math.trunc(ConVarsSDK.GetInt("dota_hud_colorblind", 0)), 0, 2)
}

/**
 * The frame tint of a side: your own hero's, an enemy's, or a friend's - which the first
 * colorblind setting tints apart, as the game does.
 */
function backing(team: ETeamState, self: boolean): string {
	const side =
		team === ETeamState.Enemy
			? "enemy"
			: self
				? "local"
				: colorblind() === 1
					? "ally_cb"
					: "ally"
	const fallback = BACKING_DEFAULTS[side]
	const rgb: Rgb =
		typeof ConVarsSDK === "undefined"
			? fallback
			: [
					ConVarsSDK.GetInt(`dota_hud_new_healthbar_${side}_r`, fallback[0]),
					ConVarsSDK.GetInt(`dota_hud_new_healthbar_${side}_g`, fallback[1]),
					ConVarsSDK.GetInt(`dota_hud_new_healthbar_${side}_b`, fallback[2])
				]
	return hex(rgb, BACKING_LIGHT)
}

/** The health tint of a hero-like bar: an enemy's, your own hero's, or a friend's. */
function heroTint(team: ETeamState, self: boolean): Rgb {
	if (team === ETeamState.Enemy) {
		return HERO_ENEMY
	}
	return (self ? HERO_LOCAL : HERO_ALLY)[colorblind()]
}

/** Rows of light as a gradient down a box, each row's colour standing at its middle. */
function down(rgb: Rgb, rows: readonly number[]): string {
	const colors = rows.map(
		(light, index) => `${hex(rgb, light)} ${((index + 0.5) * 100) / rows.length}%`
	)
	return `linear-gradient(to bottom, ${colors.join(", ")})`
}

function hex(rgb: Rgb, light: number): string {
	let text = "#"
	for (const channel of rgb) {
		const value = Math.clamp(Math.round(channel * light), 0, 255)
		text += value.toString(16).padStart(2, "0")
	}
	return text
}

function across(rgb: Rgb, light: number, stops: readonly [number, number][]): string {
	const colors = stops.map(([at, shade]) => `${hex(rgb, light * shade)} ${at}%`)
	return `linear-gradient(to right, ${colors.join(", ")})`
}

/** How far a bar's drawing reaches from its anchor, in design pixels: left and up negative. */
export interface BarReach {
	readonly left: number
	readonly top: number
	readonly right: number
	readonly bottom: number
}

/** The health row a hero-like bar is drawn from, from its anchor. */
function heroRow(spec: PreviewBar): { x: number; y: number; width: number } {
	return (
		spec.row ?? {
			x: spec.correctionX,
			y: spec.correctionY,
			width: spec.width
		}
	)
}

/** How far the drawing of `spec` reaches from its anchor. */
export function BarReachOf(spec: PreviewBar): BarReach {
	switch (spec.style) {
		case EBarStyle.Pips: {
			const left = -Math.trunc(spec.width / 2)
			const top = -spec.correctionY
			return {
				left: left - PORTRAIT - PORTRAIT_GAP,
				top: top - PORTRAIT_RISE,
				right: left + spec.width,
				bottom: Math.max(top + spec.height, top - PORTRAIT_RISE + PORTRAIT)
			}
		}
		case EBarStyle.Creep:
			return { left: -40, top: -12, right: 40, bottom: -3 }
		case EBarStyle.Large:
			return { left: -110, top: -10, right: 111, bottom: -1 }
		case EBarStyle.Summon:
			return { left: -52, top: -26, right: 53, bottom: -11 }
		default: {
			const row = heroRow(spec)
			return {
				left: -row.x - 28,
				top: -row.y - 6,
				right: -row.x + row.width + 20,
				bottom: -row.y + 20
			}
		}
	}
}

/** An image the bar shows: a file, or one sprite of a sheet. */
export interface BarArt {
	readonly path: string
	readonly region?: MenuSDK.ImageRegion
}

export class PreviewHealthBar {
	public readonly Bounds: MenuSDK.ScreenRect = { x: 0, y: 0, w: 0, h: 0 }
	/**
	 * The parts of the bar a dragged panel snaps to, in screen pixels: the rectangle the strips
	 * are laid out against, the drawing around it and, for a hero, the portrait and the level
	 * box. Laid out with the bar, so a drag reads them before they are drawn.
	 */
	public readonly Anchors: MenuSDK.ScreenRect[] = []
	/** The portrait in a hero-like bar, or beside a courier's: its owner's. */
	public Icon: BarArt = { path: "" }
	/** The level written in a hero-like bar's box. */
	public Level = "7"
	private root: Nullable<HTMLElement>
	private icon: Nullable<HTMLElement>
	private readonly parts: HTMLElement[] = []
	private used = 0
	private fontLoaded = false
	private spec: Nullable<PreviewBar>
	/** The bar the parts were last made for: one made for another is not reused part by part. */
	private drawn: Nullable<PreviewBar>
	/** The anchor, from the corner of {@link Bounds}, in design pixels. */
	private originX = 0
	private originY = 0

	public readonly Ref = (element: HTMLElement | null | undefined): void => {
		this.release()
		this.root = element ?? undefined
		this.parts.length = 0
		this.drawn = undefined
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

	/** Lays the bar of `spec` out at `anchor`, `bar` being the rectangle the strips stand on. */
	public Layout(bar: Rectangle, anchor: Vector2, spec: PreviewBar): void {
		const pixel = GUIInfo.ScaleHeight(1)
		const reach = BarReachOf(spec)
		this.spec = spec
		const left = Math.round(anchor.x + reach.left * pixel)
		const top = Math.round(anchor.y + reach.top * pixel)
		Object.assign(this.Bounds, {
			x: left,
			y: top,
			w: Math.round(anchor.x + reach.right * pixel) - left,
			h: Math.round(anchor.y + reach.bottom * pixel) - top
		})
		this.originX = (anchor.x - left) / pixel
		this.originY = (anchor.y - top) / pixel
		this.Anchors.length = 0
		this.Anchors.push(this.rect(bar.x, bar.y, bar.Width, bar.Height))
		const at = (x: number, y: number, w: number, h: number) =>
			this.rect(anchor.x + x * pixel, anchor.y + y * pixel, w * pixel, h * pixel)
		switch (spec.style) {
			case EBarStyle.Pips: {
				const x = -Math.trunc(spec.width / 2)
				const y = -spec.correctionY
				this.Anchors.push(
					at(x, y, spec.width, spec.height),
					at(x - PORTRAIT - PORTRAIT_GAP, y - PORTRAIT_RISE, PORTRAIT, PORTRAIT)
				)
				break
			}
			case EBarStyle.Creep:
				this.Anchors.push(at(-40, -12, 80, 8))
				break
			case EBarStyle.Large:
				this.Anchors.push(at(-110, -10, 221, 7))
				break
			case EBarStyle.Summon:
				this.Anchors.push(at(-52, -26, 105, 15))
				break
			default: {
				const row = heroRow(spec)
				const x = -row.x
				const y = -row.y
				this.Anchors.push(
					// the health row with the mana row under it: 1px between and 4px of mana
					at(x, y, row.width, 8 + 5),
					{ ...this.Bounds },
					at(x - 28, y - 6, 26, 26),
					at(x + row.width + 2, y - 1, 17, 8 + 8)
				)
			}
		}
	}

	public Draw(visible: boolean, team: ETeamState): void {
		const root = this.root
		const spec = this.spec
		if (root === undefined || spec === undefined) {
			return
		}
		MenuSDK.WriteShown(root, visible)
		if (!visible) {
			return
		}
		if (this.drawn !== spec) {
			this.clear()
			this.drawn = spec
		}
		MenuSDK.WritePx(root, "left", this.Bounds.x)
		MenuSDK.WritePx(root, "top", this.Bounds.y)
		MenuSDK.WritePx(root, "width", this.Bounds.w)
		MenuSDK.WritePx(root, "height", this.Bounds.h)
		this.used = 0
		const enemy = team === ETeamState.Enemy
		switch (spec.style) {
			case EBarStyle.Pips:
				this.drawPips(spec, enemy)
				break
			case EBarStyle.Creep:
				this.drawCreep(enemy)
				break
			case EBarStyle.Large:
				this.drawLarge()
				break
			case EBarStyle.Summon:
				this.drawSummon(spec, team)
				break
			default:
				this.drawHero(spec, team)
		}
		for (let index = this.used; index < this.parts.length; index++) {
			MenuSDK.WriteShown(this.parts[index], false)
		}
	}

	private drawHero(spec: PreviewBar, team: ETeamState): void {
		const pixel = GUIInfo.ScaleHeight(1)
		const row = heroRow(spec)
		const width = row.width
		const height = 8
		const x = this.originX - row.x
		const y = this.originY - row.y
		// Backing starts halfway under the icon: 2px above and 1px below the frame.
		const self = spec.self === true && team === ETeamState.Local
		this.part(x - 16, y - 3, width + 36, height + 11, backing(team, self))
		// Keep fade slots stable across unit changes and draw them below the bars.
		const fadeWidth = 1 + 17 / 2
		this.edgeFade(x - 1, y - 3, height + 11, fadeWidth)
		this.edgeFade(x + width + 1, y - 3, height + 11, fadeWidth)
		// 1px black above HP, 1px between bars, and 2px below the 4px mana bar.
		this.part(x - 1, y - 1, width + 2, height + 8, "#000000")
		this.part(
			x,
			y,
			width,
			height,
			"#00000000",
			down(heroTint(team, self), self ? HERO_ROWS_SELF : HERO_ROWS)
		)
		for (let index = 1; index < 5; index++) {
			this.part(x + Math.round((width * index) / 5), y, 2, height, "#00000050")
		}
		this.part(x, y + height + 1, width, 4, "#000000")
		this.part(x, y + height + 1, Math.round(width * 0.35), 4, "#4F78FA")
		// Shade the first mana row over its flat fill, keeping the separator above it.
		this.part(x, y + height + 1, width, 1, "#00000080")
		const levelSizePx = Math.round(pixel * levelSize)
		const levelTop = y - 1 + levelDrop(levelSizePx) / pixel
		const levelHeight = height + 8
		const level = this.part(x + width + 2, levelTop, 17, levelHeight, "#00000000")
		if (level !== undefined) {
			MenuSDK.WriteText(level, this.Level)
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
		this.portrait(x - 28, y - 6, 26, 0)
	}

	/** A courier's: a black bar of segments, its owner's portrait standing off its left end. */
	private drawPips(spec: PreviewBar, enemy: boolean): void {
		const x = this.originX - Math.trunc(spec.width / 2)
		const y = this.originY - spec.correctionY
		this.part(x, y, spec.width, spec.height, "#000000")
		const tint = (enemy ? CREEP_ENEMY : CREEP_ALLY)[colorblind()]
		const pips = Math.trunc(spec.maxHealth / 3)
		for (let index = 0; index < pips; index++) {
			this.part(
				x + PIP_BORDER + index * (PIP_SEGMENT + PIP_BORDER),
				y + PIP_BORDER,
				PIP_SEGMENT,
				PIP_SEGMENT_HEIGHT,
				"#00000000",
				across(tint, 1, PIP_ACROSS)
			)
		}
		this.portrait(
			x - PORTRAIT - PORTRAIT_GAP,
			y - PORTRAIT_RISE,
			PORTRAIT,
			PORTRAIT_RADIUS
		)
	}

	/** A lane creep's: a row of five, a shaded one under it, in a black frame. */
	private drawCreep(enemy: boolean): void {
		const x = this.originX - 40
		const y = this.originY - 11
		const tint = (enemy ? CREEP_ENEMY : CREEP_ALLY)[colorblind()]
		this.part(x, y - 1, 80, 8, "#000000")
		// the frame's foot is cut away but for its corners
		this.part(x, y + 7, 3, 1, "#000000")
		this.part(x, y + 8, 2, 1, "#000000")
		this.part(x + 77, y + 7, 3, 1, "#000000")
		this.part(x + 78, y + 8, 2, 1, "#000000")
		for (let index = 0; index < CREEP_ROWS.length; index++) {
			this.part(
				x + 1,
				y + index,
				78,
				1,
				"#00000000",
				across(tint, CREEP_ROWS[index], CREEP_ACROSS)
			)
		}
		this.part(x + 1, y + 5, 78, 1, hex(tint, 0.09))
		this.part(x + 79, y, 1, 7, hex(tint, 0.06))
	}

	/** Roshan's: six rows shaded down from the top, under a black rule and between two. */
	private drawLarge(): void {
		const x = this.originX - 110
		const y = this.originY - 9
		this.part(x, y - 1, 221, 1, "#000000")
		this.part(x, y, 1, 8, "#000000")
		this.part(x + 220, y, 1, 8, "#000000")
		for (let index = 0; index < LARGE_ROWS.length; index++) {
			this.part(
				x + 1,
				y + index,
				219,
				1,
				"#00000000",
				across(LARGE, LARGE_ROWS[index], LARGE_ACROSS)
			)
		}
	}

	/**
	 * A summon's: the rows of a hero's bar, without its portrait or level, in a grey frame while
	 * it is yours and on a hero's backing while it is not, the health marked every 250.
	 */
	private drawSummon(spec: PreviewBar, team: ETeamState): void {
		const x = this.originX - 52
		const y = this.originY - 26
		if (team === ETeamState.Local) {
			this.part(x, y, 105, 1, OUTLINE_TOP)
			this.part(x, y + 14, 105, 1, OUTLINE_BOTTOM)
			this.part(x, y + 1, 1, 13, OUTLINE_LEFT)
			this.part(x + 104, y + 1, 1, 13, OUTLINE_RIGHT)
			this.part(x + 1, y + 1, 103, 1, OUTLINE_INNER_TOP)
			this.part(x + 1, y + 13, 103, 1, OUTLINE_INNER_BOTTOM)
			this.part(x + 1, y + 2, 1, 11, OUTLINE_INNER_LEFT)
			this.part(x + 103, y + 2, 1, 11, OUTLINE_INNER_RIGHT)
		} else {
			this.part(x, y, 105, 15, backing(team, false))
		}
		this.part(x + 2, y + 2, 101, 11, "#000000")
		const tint = heroTint(team, false)
		const rows = spec.mana ? SUMMON_ROWS : SUMMON_ROWS_NO_MANA
		const healthTop = y + (spec.mana ? 2 : 3)
		for (let index = 0; index < rows.length; index++) {
			this.part(x + 2, healthTop + index, 99, 1, hex(tint, rows[index]))
		}
		const under = healthTop + rows.length
		this.part(x + 2, under, 99, 1, hex(tint, spec.mana ? 0.07 : 0.095))
		if (spec.mana) {
			this.part(x + 2, under + 1, 99, 1, hex(MANA, 0.13))
			this.part(x + 2, under + 2, 99, 2, hex(MANA, 0.97))
		}
		for (
			let health = DIVIDER_HEALTH;
			health < spec.maxHealth;
			health += DIVIDER_HEALTH
		) {
			// as the game places them over the sprite the rows are stretched across
			const at =
				Math.floor(
					0.5 +
						(SUMMON_SPRITE_WIDTH * (5 + (244 * health) / spec.maxHealth)) /
							256
				) - 1
			this.part(
				x + at,
				healthTop,
				2,
				rows.length,
				health % (DIVIDER_HEALTH * 4) === 0 ? "#000000aa" : "#00000033"
			)
		}
	}

	/** The portrait, kept in its own element: it is the one part that holds art. */
	private portrait(x: number, y: number, size: number, radius: number): void {
		const pixel = GUIInfo.ScaleHeight(1)
		this.icon = this.part(x, y, size, size, "#00000000", undefined, "img")
		if (this.icon !== undefined) {
			MenuSDK.WriteSizedArt(
				this.icon,
				this.Icon.path,
				Math.round(pixel * size),
				Math.round(pixel * size),
				Math.round(pixel * radius),
				this.Icon.region
			)
		}
	}

	private edgeFade(x: number, y: number, height: number, width: number): void {
		this.part(
			x - width,
			y,
			width * 2,
			height,
			"#00000000",
			"linear-gradient(to right, #00000000, #00000050 50%, #00000000)"
		)
	}

	/** A screen rectangle with whole-pixel edges, each rounded where it lands. */
	private rect(x: number, y: number, w: number, h: number): MenuSDK.ScreenRect {
		const left = Math.round(x)
		const top = Math.round(y)
		return {
			x: left,
			y: top,
			w: Math.round(x + w) - left,
			h: Math.round(y + h) - top
		}
	}

	/** Lets go of every part, for a bar drawn another way than the one they were made for. */
	private clear(): void {
		this.release()
		const root = this.root
		for (const element of this.parts) {
			MenuSDK.deferDestroy(element, root)
		}
		this.parts.length = 0
	}

	private release(): void {
		if (this.icon !== undefined) {
			MenuSDK.ReleaseSizedArt(this.icon)
			this.icon = undefined
		}
	}

	private part(
		x: number,
		y: number,
		w: number,
		h: number,
		color: string,
		decorator?: string,
		tag = "div"
	) {
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
		if (decorator !== undefined) {
			MenuSDK.WriteStyle(element, "decorator", decorator)
		}
		MenuSDK.WriteShown(element, true)
		return element
	}
}
