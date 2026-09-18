import { SpellMenu } from "../menu/spells"
import { TextStyleMenu } from "../menu/style"
import { BaseGUI, SpellDisplay } from "./index"

export class SpellGUI extends BaseGUI {
	private static readonly minSize = 17
	private readonly size = new Vector2()

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	) {
		super.Update(position, positionEnd, healthBarSize, additionalSize, scale)
		const size = SpellGUI.minSize + additionalSize * 4
		this.size.CopyFrom(GUIInfo.ScaleVector(size * scale, size * scale))
		this.size.x -= (this.size.x + 1) % 2
		this.size.y -= (this.size.y + 1) % 2
	}
	public Draw(
		mainAlpha: number,
		menu: SpellMenu,
		spells: [SpellDisplay, number][],
		additionalPosition: Vector2,
		isSilenced: boolean,
		isPassiveDisabled: boolean
	): void {
		if (this.Contains()) {
			return
		}
		this.DrawAt(
			this.position,
			mainAlpha,
			menu,
			spells,
			additionalPosition,
			isSilenced,
			isPassiveDisabled
		)
		this.DrawAt(
			this.positionEnd,
			mainAlpha,
			menu,
			spells,
			additionalPosition,
			isSilenced,
			isPassiveDisabled
		)
	}
	public DrawAt(
		recPosition: Rectangle,
		mainAlpha: number,
		menu: SpellMenu,
		spells: [SpellDisplay, number][],
		additionalPosition: Vector2,
		isSilenced: boolean,
		isPassiveDisabled: boolean
	) {
		if (!recPosition.pos1.IsValid) {
			return
		}
		const vecSize = this.size,
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1)
		this.BeginMotion(menu)
		for (let index = 0; index < spells.length; index++) {
			const [spell, idx] = spells[index]
			const cell = this.Seat(spell, index, spells.length)
			if (cell.appear <= 0) {
				continue
			}
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				cell.slot,
				additionalPosition
			)

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize) * this.Enter(cell)

			const position = new Rectangle(vecPos.Clone(), vecPos.Add(vecSize))
			const cooldown = spell.Cooldown,
				texture = spell.TexturePath,
				currCharges = spell.CurrentCharges,
				grayScale = spell.Level === 0 || !spell.IsActivated,
				noMana = !spell.IsManaEnough(),
				isInPhase = spell.IsInAbilityPhase || spell.IsChanneling,
				rounding = this.GetRounding(menu, vecSize),
				isAltCastState = spell.AltCastState,
				hasRootDisable = spell.HasBehavior(
					DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
				)
			let isDisabled = false,
				isUniqueDisabled = false
			if (spell.IsPassive) {
				isDisabled = isPassiveDisabled
			}
			if (hasRootDisable) {
				isUniqueDisabled = spell.Owner?.IsTethered ?? false
			}
			if (menu.IsMinimalistic.value) {
				this.minimilistic(
					idx,
					alpha,
					cell.flash,
					spell,
					vecPos,
					vecSize,
					rounding,
					border,
					position,
					cooldown,
					isSilenced || isUniqueDisabled,
					isDisabled,
					noMana,
					isAltCastState
				)
			} else {
				this.image(
					alpha,
					cell.flash,
					texture,
					vecPos,
					vecSize,
					rounding,
					border + +(rounding > 0),
					cooldown,
					grayScale,
					isInPhase,
					isSilenced || isUniqueDisabled,
					isDisabled,
					noMana,
					isAltCastState,
					spell.IsPassive
				)
			}

			const alphaCorrect = Math.min(alpha * 1.75, 255),
				levelColor = menu.LevelColor.SelectedColor.Clone().SetA(alphaCorrect),
				chargeColor = menu.ChargeColor.SelectedColor.Clone().SetA(alphaCorrect)

			if (currCharges !== 0) {
				this.Text(
					menu.TextStyle,
					currCharges.toString(),
					position,
					TextFlags.Right | TextFlags.Top,
					2.75,
					chargeColor
				)
			}

			this.squareLevel(
				spell,
				vecPos,
				vecSize,
				menu.IsMinimalistic.value,
				levelColor,
				Color.Black.SetA(alpha),
				menu.TextStyle
			)

			if (cooldown !== 0) {
				const cdText = cooldown.toFixed(cooldown <= 3 ? 1 : 0)
				this.Text(menu.TextStyle, cdText, position, TextFlags.Center)
			}
		}
		this.EndMotion()
	}
	private minimilistic(
		idx: number,
		alpha: number,
		flash: number,
		spell: SpellDisplay,
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		width: number,
		position: Rectangle,
		cooldown: number,
		isSilenced: boolean,
		isPassiveDisabled: boolean,
		noMana: boolean,
		isAltCastState: boolean
	) {
		const minimalistic = position.Clone(),
			ignoreMinimalistic = this.ignoreMinimalistic(spell, idx),
			outlinedColor = (
				noMana ? BaseGUI.noManaOutlineColor.Clone() : Color.Black
			).SetA(180 * this.fade)

		if (cooldown === 0) {
			minimalistic.Height /= 4
			minimalistic.y +=
				position.Width -
				minimalistic.Height * 0.75 -
				Math.max(GUIInfo.ScaleHeight(1), 1)
		}

		if (cooldown === 0 || !ignoreMinimalistic) {
			this.canvas.Rect(minimalistic.pos1, minimalistic.Size, {
				color: outlinedColor
			})
			this.Ring(
				this.canvas,
				minimalistic.pos1,
				minimalistic.Size,
				1,
				0,
				false,
				flash,
				alpha
			)
			return
		}
		let isDisabled = false,
			isUniqueDisabled = false
		if (spell.IsPassive) {
			isDisabled = isPassiveDisabled
		}
		const texture = spell.TexturePath,
			grayScale = spell.Level === 0 || isSilenced || !spell.IsActivated,
			isInPhase = spell.IsInAbilityPhase || spell.IsChanneling,
			hasRootDisable = spell.HasBehavior(
				DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
			)
		if (hasRootDisable) {
			isUniqueDisabled = spell.Owner?.IsTethered ?? false
		}
		this.image(
			alpha,
			flash,
			texture,
			vecPos,
			vecSize,
			rounding,
			width,
			cooldown,
			grayScale,
			isInPhase,
			isSilenced || isUniqueDisabled,
			isDisabled,
			noMana,
			isAltCastState,
			spell.IsPassive
		)
	}
	private image(
		alpha: number,
		flash: number,
		texture: string,
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		border: number,
		cooldown: number,
		grayScale: boolean,
		isInPhase?: boolean,
		isUniqueDisabled?: boolean,
		isPassiveDisabled?: boolean,
		noMana?: boolean,
		isAltCastState?: boolean,
		isPassive?: boolean
	) {
		let outlinedColor = Color.Black
		const noManaColor = BaseGUI.noManaOutlineColor.Clone()
		if (noMana) {
			outlinedColor = noManaColor.Clone()
		} else if (isAltCastState) {
			outlinedColor = Color.Aqua
		} else if (isInPhase) {
			outlinedColor = Color.Green
		} else if (
			cooldown !== 0 ||
			(isUniqueDisabled && !isPassive) ||
			isPassiveDisabled
		) {
			outlinedColor = Color.Red
		}

		this.canvas.Rect(vecPos, vecSize, {
			color: Color.fromUint32(0),
			borderColor: outlinedColor.SetA(alpha),
			borderWidth: Math.round(border),
			radius: Math.max(rounding / 2, 0)
		})

		this.canvas.Image(texture, vecPos, vecSize, {
			color: (noMana ? noManaColor.Clone() : Color.White).SetA(alpha),
			radius: Math.max(rounding / 2, 0),
			circle: rounding === 0,
			grayscale: grayScale
		})
		if (isPassiveDisabled) {
			this.ImageMask(vecPos, vecSize, rounding, false)
		}
		if (isUniqueDisabled && !isPassive) {
			this.ImageMask(vecPos, vecSize, rounding, true)
		}
		if (cooldown !== 0) {
			this.canvas.Rect(vecPos, vecSize, {
				color: Color.Black.SetA(alpha * (100 / 255)),
				radius:
					rounding === 0
						? Math.min(vecSize.x, vecSize.y) / 2
						: Math.max(rounding / 2, 0)
			})
		}
		this.Ring(
			this.canvas,
			vecPos,
			vecSize,
			Math.round(border),
			Math.max(rounding / 2, 0),
			rounding === 0,
			flash,
			alpha
		)
	}
	private squareLevel(
		spell: SpellDisplay,
		vecPos: Vector2,
		vecSize: Vector2,
		minimalistic: boolean,
		levelColor: Color,
		outlineColor: Color,
		textStyle: TextStyleMenu
	) {
		const currLvl = spell.Level
		if (spell.MaxLevel === 0 || currLvl === 0) {
			return
		}

		const position = new Rectangle(vecPos.Clone(), vecPos.Add(vecSize))
		if (currLvl >= 5) {
			this.Text(
				textStyle,
				currLvl.toString(),
				position,
				TextFlags.Right | TextFlags.Bottom,
				2,
				levelColor
			)
			return
		}

		const fillColor = !(minimalistic && !spell.IsManaEnough())
			? levelColor
			: BaseGUI.noManaOutlineColor

		const borderThickness = 1
		const maxLvl = 4
		const step = ((vecSize.x + borderThickness * 2) / maxLvl) | 0
		const borderSize = new Vector2(borderThickness, borderThickness)
		const squareSize = new Vector2(step, Math.round(step * 0.5)).Add(borderSize)

		const pos = position.pos1
			.Clone()
			.AddScalarX((vecSize.x - (step * maxLvl + borderThickness)) / 2)
			.AddScalarX(step * (maxLvl - currLvl) * 0.5)
			.AddScalarY(position.Size.y - squareSize.y)

		for (let i = 0; i < currLvl; i++) {
			this.canvas.Rect(pos, squareSize, { color: outlineColor })
			this.canvas.Rect(
				pos.Add(borderSize),
				squareSize.Subtract(borderSize.MultiplyScalar(2)),
				{ color: fillColor }
			)
			pos.AddScalarX(step)
		}
	}
	private ignoreMinimalistic(spell: SpellDisplay, idx: number) {
		const owner = spell.Owner
		if (owner === undefined || owner.IsNeutral) {
			return false
		}
		if (
			owner instanceof npc_dota_hero_rubick ||
			owner instanceof npc_dota_hero_invoker ||
			owner instanceof npc_dota_hero_doom_bringer
		) {
			return (
				idx === EAbilitySlot.DOTA_SPELL_SLOT_4 ||
				idx === EAbilitySlot.DOTA_SPELL_SLOT_5
			)
		}
		return false
	}
}
