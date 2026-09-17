import { canvas as timerCanvas, surface } from "../../render"
import { BaseMenu } from "../menu/base"
import { TextStyleMenu } from "../menu/style"
import { DrawStyledText } from "./text"
import {
	GuiCanvas,
	ItemDisplay,
	ModifierDisplay,
	SpellDisplay,
	TextSurface
} from "./types"

export type { ItemDisplay, ModifierDisplay, SpellDisplay } from "./types"

const ORIGIN = new Vector2()

export abstract class BaseGUI {
	protected static readonly border = 2
	protected static readonly noManaOutlineColor = new Color(77, 131, 247)

	protected readonly position = new Rectangle()
	protected readonly positionEnd = new Rectangle()

	/**
	 * `timers` is the SDK canvas a round icon is drawn on as its circular timer, the way
	 * teleport-esp draws its markers, and `origin` is where this surface's own top left corner
	 * stands on that canvas: nowhere in the game, where both are the screen, and at the stage's
	 * frame in the preview. A surface with no such canvas draws its rings itself.
	 */
	constructor(
		protected readonly canvas: GuiCanvas = surface,
		protected readonly textSurface: TextSurface = surface,
		private readonly cursor: () => Vector2 = () => InputManager.CursorOnScreen,
		protected readonly timers: MenuSDK.Canvas | null = timerCanvas,
		protected readonly origin: () => Vector2 = () => ORIGIN
	) {}

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		size: Vector2,
		_additionalSize: number,
		_scale: number
	): void {
		if (position === undefined) {
			this.position.pos1.Invalidate()
			this.position.pos2.Invalidate()
		} else {
			this.position.pos1.CopyFrom(position)
			this.position.pos2.CopyFrom(position).AddForThis(size)
		}

		if (positionEnd === undefined) {
			this.positionEnd.pos1.Invalidate()
			this.positionEnd.pos2.Invalidate()
		} else {
			this.positionEnd.pos1.CopyFrom(positionEnd)
			this.positionEnd.pos2.CopyFrom(positionEnd).AddForThis(size)
		}
	}

	public abstract Draw(
		alpha: number,
		menu: BaseMenu,
		data: [SpellDisplay, number][] | ModifierDisplay[] | ItemDisplay[],
		additionalPosition: Vector2,
		isDisable?: boolean,
		isUniqueDisabled?: boolean
	): void

	protected Contains() {
		return (
			GUIInfo.ContainsShop(this.position.pos1) ||
			GUIInfo.ContainsMiniMap(this.position.pos1) ||
			GUIInfo.ContainsScoreboard(this.position.pos1) ||
			GUIInfo.ContainsShop(this.positionEnd.pos1) ||
			GUIInfo.ContainsMiniMap(this.positionEnd.pos1) ||
			GUIInfo.ContainsScoreboard(this.positionEnd.pos1)
		)
	}
	protected Text(
		style: TextStyleMenu,
		text: string,
		position: Rectangle,
		flags: TextFlags,
		division = 2,
		color = style.Color.SelectedColor,
		minTextScale = 70
	) {
		DrawStyledText(
			style,
			text,
			position,
			flags,
			position.Height / Math.max(division, 1.2) + 4,
			color,
			this.textSurface,
			minTextScale
		)
	}
	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		index: number,
		additionalPosition: Vector2,
		vertical = false,
		count: number = 0
	) {
		const posX = rec.x + (rec.Width + border) / 2
		const posY = rec.y - size.y - border * 2
		const center = new Vector2(posX, posY).SubtractScalarX(
			((size.x + border) * (vertical ? 0 : count)) / 2
		)
		if (vertical) {
			center.AddScalarY(index * (size.y + border))
		} else {
			center.AddScalarX(index * (size.x + border))
		}
		return center.AddForThis(additionalPosition).RoundForThis()
	}
	protected GetRounding(menu: BaseMenu, size: Vector2): number {
		const rnd = (menu.Rounding.value / 10) * Math.min(size.x, size.y)
		return rnd === 1 ? -1 : rnd - 1
	}
	protected GetAlpha(mainAlpha: number, vecPos: Vector2, vecSize: Vector2): number {
		if (mainAlpha > 0) {
			return mainAlpha
		}
		const startDistance = (vecSize.x + vecSize.y) * 4
		const cursor = this.cursor()
		const distance = Math.hypot(
			cursor.x - (vecPos.x + vecSize.x / 2),
			cursor.y - (vecPos.y + vecSize.y / 2)
		)
		return -1 * mainAlpha * Math.min(Math.max(0.5, distance / startDistance), 1)
	}
	protected ImageMask(
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		isSilenced: boolean
	) {
		const base = PathData.ImagePath + "/hud/reborn/"
		const image = isSilenced ? "spells_silenced" : "passives_broken"
		this.canvas.Image(base + `${image}_psd.vtex_c`, vecPos, vecSize, {
			radius: Math.max(rounding / 2, 0),
			circle: rounding === 0
		})
	}
}
