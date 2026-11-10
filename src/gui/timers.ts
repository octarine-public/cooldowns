import { SurfaceText } from "./canvas"
import { TextSurface } from "./types"

/** What a modifier strip's round timers go out on: the SDK canvas they are drawn on, and the readings over them. */
export interface TimerSheet {
	readonly Canvas: MenuSDK.Canvas
	readonly Text: TextSurface
}

/**
 * Where the round timers of modifier strips are drawn, a strip at a time, keyed by its bar.
 * `Open` hands the strip the sheet it draws on, its anchor standing at `x`, `y`; `Keep` holds
 * what the strip last drew there, moved to where its anchor stands now, and answers whether it
 * could; `Drop`, where a board keeps sheets, lets the strip's sheet go for good. With a render
 * anchor the sheet is tied to it - the core moves it with the bar as each frame is presented -
 * and `x`, `y` and what is drawn on the sheet are px from where that anchor lands.
 */
export interface TimerBoard {
	Open(key: object, x: number, y: number, anchor?: CRenderAnchor): TimerSheet
	Keep(key: object, x: number, y: number, anchor?: CRenderAnchor): boolean
	Drop?(key: object): void
}

/**
 * One strip's sheet: a surface of its own, and where the strip's anchor stood when it was last
 * drawn, on which render anchor's slot (-1 for the screen).
 */
class StripSheet implements TimerSheet {
	public readonly Canvas: MenuSDK.Canvas
	public readonly Text: TextSurface
	public readonly Surface: MenuSDK.CHudSurface
	public x = 0
	public y = 0
	public slot = -1

	constructor(public readonly Key: string) {
		this.Canvas = new MenuSDK.Canvas(Key)
		this.Surface = MenuSDK.HudSurfaceOf(Key, MenuSDK.EPanelLayer.World)
		this.Text = new SurfaceText(this.Surface)
	}
}

/**
 * The game's board: every strip on a surface of its own, so a strip drawn from what it was last
 * drawn from is only moved after its bar, by whole pixels (`MenuSDK.CHudSurface.Keep`), while the
 * others are drawn again. The sheets stand in the order they are opened or held this frame, see
 * {@link StripTimers.Begin}: the strips are drawn the farthest from the cursor first, so the
 * nearest stands over those it overlaps. A sheet is made the first time its strip draws a round
 * timer, and a strip not drawn or held in a frame is wiped by the surface itself. A sheet drawn
 * on one render anchor is not held on another, or on the screen: it is drawn again.
 */
export class StripTimers implements TimerBoard {
	private readonly sheets = new Map<object, StripSheet>()
	private made = 0
	private order = 0

	constructor(private readonly prefix: string) {}

	/** Opens the frame: the first sheet opened or held from here stands under the rest. */
	public Begin(): void {
		this.order = 0
	}
	public Open(key: object, x: number, y: number, anchor?: CRenderAnchor): TimerSheet {
		let sheet = this.sheets.get(key)
		if (sheet === undefined) {
			sheet = new StripSheet(`${this.prefix}:${++this.made}`)
			this.sheets.set(key, sheet)
		}
		sheet.x = x
		sheet.y = y
		sheet.slot = anchor?.Slot ?? -1
		sheet.Canvas.Anchor(anchor)
		sheet.Surface.Order(this.order++)
		return sheet
	}
	public Keep(key: object, x: number, y: number, anchor?: CRenderAnchor): boolean {
		const sheet = this.sheets.get(key)
		if (
			sheet === undefined ||
			sheet.slot !== (anchor?.Slot ?? -1) ||
			!sheet.Surface.Keep(x - sheet.x, y - sheet.y)
		) {
			return false
		}
		sheet.Surface.Order(this.order++)
		return true
	}
	public Drop(key: object): void {
		const sheet = this.sheets.get(key)
		if (sheet !== undefined) {
			this.sheets.delete(key)
			MenuSDK.DropHudSurface(sheet.Key)
		}
	}
}

/** One sheet every strip draws on, drawn afresh every frame: the preview's, whose strips have no stamp. */
export class SharedTimers implements TimerBoard {
	private readonly sheet: TimerSheet

	constructor(canvas: MenuSDK.Canvas, text: TextSurface) {
		this.sheet = { Canvas: canvas, Text: text }
	}

	public Open(): TimerSheet {
		return this.sheet
	}
	public Keep(): boolean {
		return false
	}
}
