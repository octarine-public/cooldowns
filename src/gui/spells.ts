import { BaseMenu } from "../menu/base"
import { SpellMenu } from "../menu/spells"
import { TextStyleMenu } from "../menu/style"
import { UnitBody } from "../models/body"
import { BaseGUI, CellShapeStyle, SpellDisplay } from "./index"

/** What a cell shows of its spell, read once a tick. */
interface SpellReading {
	spell?: SpellDisplay
	tick: number
	cooldown: number
	texture: string
	charges: number
	level: number
	maxLevel: number
	grayScale: boolean
	noMana: boolean
	inPhase: boolean
	altCast: boolean
	passive: boolean
	tethered: boolean
	unlearned: boolean
	inactive: boolean
	washSource?: string
}

export class SpellGUI extends BaseGUI {
	private static readonly minSize = 17
	private readonly size = new Vector2()
	/** Scratch the cell being drawn is laid out in, read straight away by everything it is handed to. */
	private readonly cellBox = new Rectangle()
	private readonly levelColor = new Color()
	private readonly chargeColor = new Color()
	private readonly levelOutline = new Color(0, 0, 0)
	private readonly pipPosition = new Vector2()
	private readonly pipInner = new Vector2()
	private readonly pipSize = new Vector2()
	private readonly pipInnerSize = new Vector2()
	/** Styles the canvas reads as it is called and keeps none of, refilled for each cell. */
	private readonly rimStyle: CellShapeStyle = {}
	private readonly pipOutline: CellShapeStyle = {}
	private readonly pipFill: CellShapeStyle = {}
	/** Each cell's reading of its spell, by the cell's place in the strip. */
	private readonly readings: SpellReading[] = []

	/**
	 * How far right a column of items stands to clear this strip hanging from the same bar as a
	 * column: the spell cell and its gap while both strips are columns and this one is drawn at
	 * all, nothing otherwise. Both hang from the bar's right end, and the spells stand nearest
	 * it as they do under it in a row; two columns on one anchor would stand on each other.
	 */
	public ColumnShift(spells: SpellMenu, items: BaseMenu, drawn: boolean): number {
		return drawn && spells.IsVertical && items.IsVertical
			? this.size.x + GUIInfo.ScaleHeight(BaseGUI.border + 1)
			: 0
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
		const rise = this.Rise(menu, this.size.y, GUIInfo.ScaleHeight(BaseGUI.border + 1))
		this.DrawAt(
			this.position,
			mainAlpha,
			menu,
			spells,
			this.Follow(additionalPosition, rise),
			isSilenced,
			isPassiveDisabled
		)
		this.DrawAt(
			this.positionEnd,
			mainAlpha,
			menu,
			spells,
			this.Follow(additionalPosition, rise, true),
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
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1),
			vertical = menu.IsVertical
		this.wash = this.NoManaWash(menu)
		this.BeginMotion(menu)
		for (let index = 0; index < spells.length; index++) {
			const [spell, idx] = spells[index]
			const cell = this.Seat(spell, index, spells.length, vertical)
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

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize) * this.Enter(cell)

			const position = this.cellBox
			position.pos1.CopyFrom(vecPos)
			position.pos2.CopyFrom(vecPos).AddForThis(vecSize)
			const reading = this.read(spell, index),
				cooldown = reading.cooldown,
				currCharges = reading.charges,
				noMana = reading.noMana,
				rounding = this.GetRounding(menu, vecSize),
				isDisabled = reading.passive && isPassiveDisabled,
				isUniqueDisabled = reading.tethered
			if (menu.IsMinimalistic.value) {
				this.minimilistic(
					idx,
					alpha,
					cell.flash,
					spell,
					reading,
					vecPos,
					vecSize,
					rounding,
					border,
					position,
					isSilenced || isUniqueDisabled,
					isDisabled
				)
			} else {
				this.image(
					alpha,
					cell.flash,
					reading.texture,
					vecPos,
					vecSize,
					rounding,
					border + +(rounding > 0),
					cooldown,
					reading.grayScale,
					reading.inPhase,
					isSilenced || isUniqueDisabled,
					isDisabled,
					noMana,
					reading.altCast,
					reading.passive,
					reading.washSource
				)
			}

			const alphaCorrect = Math.min(alpha * 1.75, 255)

			if (currCharges !== 0) {
				this.Text(
					menu.TextStyle,
					currCharges.toString(),
					position,
					TextFlags.Right | TextFlags.Top,
					2.75,
					this.chargeColor
						.CopyFrom(menu.ChargeColor.SelectedColor)
						.SetA(alphaCorrect)
				)
			}

			this.squareLevel(
				reading,
				vecPos,
				vecSize,
				menu.IsMinimalistic.value && noMana,
				this.levelColor
					.CopyFrom(menu.LevelColor.SelectedColor)
					.SetA(alphaCorrect),
				this.levelOutline.SetA(alpha),
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
		reading: SpellReading,
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		width: number,
		position: Rectangle,
		isSilenced: boolean,
		isPassiveDisabled: boolean
	) {
		const cooldown = reading.cooldown,
			minimalistic = position.Clone(),
			ignoreMinimalistic = this.ignoreMinimalistic(spell, idx),
			outlinedColor = this.cellRim
				.CopyFrom(reading.noMana ? BaseGUI.noManaOutlineColor : BaseGUI.black)
				.SetA(180 * this.fade)

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
		this.image(
			alpha,
			flash,
			reading.texture,
			vecPos,
			vecSize,
			rounding,
			width,
			cooldown,
			reading.unlearned || isSilenced || reading.inactive,
			reading.inPhase,
			isSilenced || reading.tethered,
			reading.passive && isPassiveDisabled,
			reading.noMana,
			reading.altCast,
			reading.passive,
			reading.washSource
		)
	}
	/** The cell's reading of `spell`, taken afresh only on a new tick or for another spell. */
	private read(spell: SpellDisplay, index: number): SpellReading {
		let reading = this.readings[index]
		if (reading === undefined) {
			reading = this.readings[index] = {
				tick: -1,
				cooldown: 0,
				texture: "",
				charges: 0,
				level: 0,
				maxLevel: 0,
				grayScale: false,
				noMana: false,
				inPhase: false,
				altCast: false,
				passive: false,
				tethered: false,
				unlearned: false,
				inactive: false
			}
		}
		const tick = this.Tick()
		if (tick !== -1 && reading.tick === tick && reading.spell === spell) {
			return reading
		}
		reading.spell = spell
		reading.tick = tick
		reading.cooldown = spell.Cooldown
		reading.texture = spell.TexturePath
		reading.charges = spell.CurrentCharges
		reading.level = spell.Level
		reading.maxLevel = spell.MaxLevel
		reading.unlearned = reading.level === 0
		reading.inactive = !spell.IsActivated
		reading.grayScale = reading.unlearned || reading.inactive
		reading.noMana = !spell.IsManaEnough()
		reading.inPhase = spell.IsInAbilityPhase || spell.IsChanneling
		reading.altCast = spell.AltCastState
		reading.passive = spell.IsPassive
		reading.tethered =
			spell.HasBehavior(
				DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
			) &&
			(spell.Owner?.IsTethered ?? false)
		reading.washSource = spell.WashSource
		return reading
	}
	/**
	 * A cell as the game's own ability button draws its states: the icon washed blue while its
	 * owner cannot pay for it, grayed while it is unlearned, shaded while it is on cooldown, and
	 * its rim in the colour of what is stopping it - the bevel's blue without mana, aqua for an
	 * alternate cast, green through its cast point, red on cooldown or disabled.
	 */
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
		isPassive?: boolean,
		washSource?: string
	) {
		const outlinedColor = this.cellRim.CopyFrom(
			noMana
				? BaseGUI.noManaOutlineColor
				: isAltCastState
					? BaseGUI.aqua
					: isInPhase
						? BaseGUI.buffColor
						: cooldown !== 0 ||
							  (isUniqueDisabled && !isPassive) ||
							  isPassiveDisabled
							? BaseGUI.cooldownColor
							: BaseGUI.black
		)

		const rim = this.rimStyle
		rim.color = BaseGUI.transparent
		rim.borderColor = outlinedColor.SetA(alpha)
		rim.borderWidth = Math.round(border)
		rim.radius = Math.max(rounding / 2, 0)
		this.canvas.Rect(vecPos, vecSize, rim)

		this.canvas.Image(texture, vecPos, vecSize, {
			color: this.white.SetA(alpha),
			wash: noMana ? this.wash : undefined,
			washSource,
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
			this.Shade(vecPos, vecSize, rounding, alpha)
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
		reading: SpellReading,
		vecPos: Vector2,
		vecSize: Vector2,
		noManaFill: boolean,
		levelColor: Color,
		outlineColor: Color,
		textStyle: TextStyleMenu
	) {
		const currLvl = reading.level
		if (reading.maxLevel === 0 || currLvl === 0) {
			return
		}

		if (currLvl >= 5) {
			const position = this.cellBox
			position.pos1.CopyFrom(vecPos)
			position.pos2.CopyFrom(vecPos).AddForThis(vecSize)
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

		const fillColor = noManaFill ? BaseGUI.noManaOutlineColor : levelColor

		const borderThickness = 1
		const maxLvl = 4
		const step = ((vecSize.x + borderThickness * 2) / maxLvl) | 0
		const squareSize = this.pipSize
			.SetX(step + borderThickness)
			.SetY(Math.round(step * 0.5) + borderThickness)
		const innerSize = this.pipInnerSize
			.SetX(squareSize.x - borderThickness * 2)
			.SetY(squareSize.y - borderThickness * 2)

		const pos = this.pipPosition
			.CopyFrom(vecPos)
			.AddScalarX((vecSize.x - (step * maxLvl + borderThickness)) / 2)
			.AddScalarX(step * (maxLvl - currLvl) * 0.5)
			.AddScalarY(vecSize.y - squareSize.y)
		const inner = this.pipInner
		const outline = this.pipOutline,
			fill = this.pipFill
		outline.color = outlineColor
		fill.color = fillColor

		// neighbouring pips share their rims, so the rims of a run are one plate under its faces
		squareSize.x += step * (currLvl - 1)
		this.canvas.Rect(pos, squareSize, outline)
		for (let i = 0; i < currLvl; i++) {
			this.canvas.Rect(
				inner
					.CopyFrom(pos)
					.AddScalarX(borderThickness)
					.AddScalarY(borderThickness),
				innerSize,
				fill
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
