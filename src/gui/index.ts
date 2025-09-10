import {
	Ability,
	Color,
	GUIInfo,
	Input,
	Item,
	Modifier,
	PathData,
	Rectangle,
	RendererSDK,
	TextFlags,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { BaseMenu } from "../menu/base"

export abstract class BaseGUI {
	protected static readonly border = 2
	protected static readonly fontWidth = 500
	protected static readonly noManaOutlineColor = new Color(77, 131, 247)

	protected readonly position = new Rectangle()
	protected readonly positionEnd = new Rectangle()

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
			this.position.pos2.CopyFrom(position.Add(size))
		}

		if (positionEnd === undefined) {
			this.positionEnd.pos1.Invalidate()
			this.positionEnd.pos2.Invalidate()
		} else {
			this.positionEnd.pos1.CopyFrom(positionEnd)
			this.positionEnd.pos2.CopyFrom(positionEnd.Add(size))
		}
	}

	public abstract Draw(
		alpha: number,
		menu: BaseMenu,
		data: [Ability, number][] | Modifier[] | Item[],
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
		text: string,
		position: Rectangle,
		flags: TextFlags,
		division = 2,
		color = Color.White
	) {
		RendererSDK.TextByFlags(text, position, color, division, flags, BaseGUI.fontWidth)
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
		const distance = Input.CursorOnScreen.Distance(
			vecPos.Add(vecSize.DivideScalar(2))
		)
		return -1 * mainAlpha * Math.min(Math.max(0.5, distance / startDistance), 1)
	}
	protected textChargeOrLevel(
		value: number,
		isCharge: boolean,
		position: Rectangle,
		color: Color
	) {
		if (value === 0) {
			return
		}
		const flags = isCharge
			? TextFlags.Right | TextFlags.Top
			: TextFlags.Right | TextFlags.Bottom
		this.Text(value.toString(), position, flags, 2, color)
	}

	protected ImageMask(
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		isSilenced: boolean
	) {
		const base = PathData.ImagePath + "/hud/reborn/"
		const image = isSilenced ? "spells_silenced" : "passives_broken"
		RendererSDK.Image(base + `${image}_psd.vtex_c`, vecPos, rounding, vecSize)
	}
}
