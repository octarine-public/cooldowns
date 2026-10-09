import { BaseMenu } from "../menu/base"
import { ItemMenu } from "../menu/items"
import { UnitBody } from "../models/body"
import { BaseGUI, CellShapeStyle, ItemDisplay } from "./index"

/** What a cell shows of its item, read once a tick. */
interface ItemReading {
	item?: ItemDisplay
	tick: number
	cooldown: number
	charges: number
	texture: string
	rootDisables: boolean
	muted: boolean
	manaEnough: boolean
}

export class ItemGUI extends BaseGUI {
	private static readonly minSize = 16
	private static readonly outlineColor = Color.Black

	private readonly size = new Vector2()
	/** Scratch the cell being drawn is laid out in, read straight away by everything it is handed to. */
	private readonly cellSize = new Vector2()
	private readonly cellBox = new Rectangle()
	/** The rim's style, refilled for each cell: the canvas reads it as it is called and keeps none of it. */
	private readonly rimStyle: CellShapeStyle = {}
	/** Each cell's reading of its item, by the cell's place in the strip. */
	private readonly readings: ItemReading[] = []

	/**
	 * How far right a column of modifiers stands to clear this strip hanging from the same bar
	 * as a column: the item cell and its gap while both strips are columns and this one is drawn
	 * at all, nothing otherwise.
	 */
	public ColumnShift(items: ItemMenu, other: BaseMenu, drawn: boolean): number {
		if (!(drawn && items.IsVertical && other.IsVertical)) {
			return 0
		}
		const width = items.SquareMode.SelectedID ? this.size.y : this.size.x
		return width + GUIInfo.ScaleHeight(BaseGUI.border + 1)
	}

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number,
		body?: UnitBody,
		bodyEnd?: UnitBody
	) {
		super.Update(
			position,
			positionEnd,
			healthBarSize,
			additionalSize,
			scale,
			body,
			bodyEnd
		)
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
		const rise = this.Rise(menu, this.size.y, GUIInfo.ScaleHeight(BaseGUI.border + 1))
		this.DrawAt(
			this.position,
			mainAlpha,
			menu,
			items,
			this.Follow(additionalPosition, rise),
			isDisable,
			isTethered
		)
		this.DrawAt(
			this.positionEnd,
			mainAlpha,
			menu,
			items,
			this.Follow(additionalPosition, rise, true),
			isDisable,
			isTethered
		)
	}

	/**
	 * A cell as the game's own inventory slot draws its states: the icon washed blue while its
	 * owner cannot pay for it, optionally shaded on cooldown, and its rim in the colour of what
	 * is stopping it - the bevel's blue without mana, red on cooldown or muted.
	 */
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
			vecSize = this.cellSize
				.SetX(!!menu.SquareMode.SelectedID ? this.size.y : this.size.x)
				.SetY(this.size.y),
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1),
			vertical = menu.IsVertical

		this.wash = this.NoManaWash(menu)
		this.BeginMotion(menu)
		for (let index = 0; index < items.length; index++) {
			const item = items[index]
			const cell = this.Seat(item, index, items.length, vertical)
			if (cell.appear <= 0) {
				continue
			}
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				cell.slot,
				additionalPosition,
				vertical
			)

			const reading = this.read(item, index),
				alpha = this.GetAlpha(mainAlpha, vecPos, vecSize) * this.Enter(cell),
				cooldown = reading.cooldown,
				charge = reading.charges

			const isUniqueDisabled = isTethered && reading.rootDisables
			const isMuted = isDisable || isUniqueDisabled || reading.muted
			// the game washes an item its owner cannot pay for, unless the item is muted anyway
			const noMana = !isMuted && !reading.manaEnough
			const outlineColor = this.cellRim
				.CopyFrom(
					noMana
						? BaseGUI.noManaOutlineColor
						: isMuted || cooldown > 0
							? BaseGUI.cooldownColor
							: ItemGUI.outlineColor
				)
				.SetA(alpha)

			const rounding = this.GetRounding(menu, vecSize)
			const radius = Math.max(rounding / 2, 0)
			const width = border + +(rounding > 0)

			const rim = this.rimStyle
			rim.color = BaseGUI.transparent
			rim.borderColor = outlineColor
			rim.borderWidth = width
			rim.radius = radius
			this.canvas.Rect(vecPos, vecSize, rim)

			this.canvas.Image(reading.texture, vecPos, vecSize, {
				color: this.white.SetA(alpha),
				wash: noMana ? this.wash : undefined,
				radius,
				circle: rounding === 0
			})
			if (cooldown > 0 && menu.DimOnCooldown.value) {
				this.Shade(vecPos, vecSize, rounding, alpha)
			}
			this.Ring(
				this.canvas,
				vecPos,
				vecSize,
				width,
				radius,
				rounding === 0,
				cell.flash,
				alpha
			)

			if (!charge && !cooldown) {
				continue
			}

			const position = this.cellBox
			position.pos1.CopyFrom(vecPos)
			position.pos2.CopyFrom(vecPos).AddForThis(vecSize)
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
			const textPosition = position
			if (canOffset) {
				textPosition.Add(GUIInfo.ScaleVector(minOffset, minOffset))
			}
			this.Text(menu.TextStyle, cdText, textPosition, flags)
		}
		this.EndMotion()
	}
	/** The cell's reading of `item`, taken afresh only on a new tick or for another item. */
	private read(item: ItemDisplay, index: number): ItemReading {
		let reading = this.readings[index]
		if (reading === undefined) {
			reading = this.readings[index] = {
				tick: -1,
				cooldown: 0,
				charges: 0,
				texture: "",
				rootDisables: false,
				muted: false,
				manaEnough: true
			}
		}
		const tick = this.Tick()
		if (tick !== -1 && reading.tick === tick && reading.item === item) {
			return reading
		}
		reading.item = item
		reading.tick = tick
		reading.cooldown = item.Cooldown
		reading.charges = item.DisplayCharges
		reading.texture = item.TexturePath
		reading.rootDisables = item.HasBehavior(
			DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
		)
		reading.muted = item.IsMuted
		reading.manaEnough = item.IsManaEnough()
		return reading
	}
}
