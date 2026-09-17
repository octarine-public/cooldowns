import { ItemMenu } from "../menu/items"
import { BaseGUI, ItemDisplay } from "./index"

export class ItemGUI extends BaseGUI {
	private static readonly minSize = 16
	private static readonly outlineColor = Color.Black

	private readonly size = new Vector2()

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	) {
		super.Update(position, positionEnd, healthBarSize, additionalSize, scale)
		const square = ItemGUI.minSize + additionalSize

		this.size.CopyFrom(GUIInfo.ScaleVector(square * 1.375 * scale, square * scale))
	}
	public Draw(
		mainAlpha: number,
		menu: ItemMenu,
		items: ItemDisplay[],
		additionalPosition: Vector2,
		isDisable: boolean,
		isTethered: boolean
	): void {
		if (this.Contains()) {
			return
		}
		this.DrawAt(
			this.position,
			mainAlpha,
			menu,
			items,
			additionalPosition,
			isDisable,
			isTethered
		)
		this.DrawAt(
			this.positionEnd,
			mainAlpha,
			menu,
			items,
			additionalPosition,
			isDisable,
			isTethered
		)
	}

	public DrawAt(
		recPosition: Rectangle,
		mainAlpha: number,
		menu: ItemMenu,
		items: ItemDisplay[],
		additionalPosition: Vector2,
		isDisable: boolean,
		isTethered: boolean
	) {
		if (!recPosition.pos1.IsValid) {
			return
		}
		const additionalSize = menu.Size.value,
			vecSize = new Vector2(
				!!menu.SquareMode.SelectedID ? this.size.y : this.size.x,
				this.size.y
			),
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1)

		for (let index = items.length - 1; index > -1; index--) {
			const item = items[index]
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				index,
				additionalPosition,
				false,
				items.length
			)

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize),
				cooldown = item.Cooldown,
				charge = item.CurrentCharges

			const hasRootDisable = item.HasBehavior(
				DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
			)
			const isUniqueDisabled = isTethered && hasRootDisable
			const outlineColor = (
				isDisable || isUniqueDisabled || item.IsMuted
					? Color.Red
					: ItemGUI.outlineColor.Clone()
			).SetA(alpha)

			const rounding = this.GetRounding(menu, vecSize)

			this.canvas.Rect(vecPos, vecSize, {
				color: Color.fromUint32(0),
				borderColor: outlineColor,
				borderWidth: border + +(rounding > 0),
				radius: Math.max(rounding / 2, 0)
			})

			this.canvas.Image(item.TexturePath, vecPos, vecSize, {
				color: Color.White.SetA(alpha),
				radius: Math.max(rounding / 2, 0),
				circle: rounding === 0
			})

			if (!charge && !cooldown) {
				continue
			}

			const position = new Rectangle(vecPos, vecPos.Add(vecSize))
			if (charge !== 0) {
				const charges = charge.toString()
				this.Text(
					menu.TextStyle,
					charges,
					position,
					TextFlags.Right | TextFlags.Bottom,
					2.75,
					undefined,
					additionalSize === 0 ? 100 : 70
				)
			}

			if (cooldown <= 0) {
				continue
			}

			const minOffset = 3
			const noCharge = charge === 0

			const flags = noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top
			const cdText = cooldown.toFixed(cooldown <= 10 ? 1 : 0)
			const canOffset = !noCharge && additionalSize >= minOffset
			const textPosition = canOffset ? position.Clone() : position
			if (canOffset) {
				textPosition.Add(GUIInfo.ScaleVector(minOffset, minOffset))
			}
			this.Text(menu.TextStyle, cdText, textPosition, flags)
		}
	}
}
