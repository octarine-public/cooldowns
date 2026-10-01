import { surface } from "../../render"
import { TextStyleMenu } from "../menu/style"
import { TextSurface } from "./types"

export function DrawStyledText(
	style: TextStyleMenu,
	text: string,
	box: Rectangle,
	flags: TextFlags,
	baseSize: number,
	color = style.Color.SelectedColor,
	target: TextSurface = surface,
	minScale = 70
): void {
	let size = Math.min(
		Math.round((baseSize * Math.max(style.Size.value, minScale)) / 100),
		Math.floor(box.Height)
	)
	if (text === "" || box.Width <= 0 || size <= 0) {
		return
	}
	const family = style.FontFamily
	const weight = style.FontWeight
	const measured = MenuSDK.MeasureTextPx(text.replace(/\d/g, "0"), size, weight, family)
	if (measured !== undefined && measured[0] > box.Width) {
		size = Math.max(Math.floor((size * box.Width) / measured[0]), 1)
	}
	// Let RmlUi center the line inside the icon instead of positioning a font-size box.
	const height = (flags & (TextFlags.Top | TextFlags.Bottom)) !== 0 ? size : box.Height
	const y =
		(flags & TextFlags.Top) === 0 && (flags & TextFlags.Bottom) !== 0
			? box.pos2.y - height
			: box.y
	const align =
		(flags & TextFlags.Left) !== 0
			? "left"
			: (flags & TextFlags.Right) !== 0
				? "right"
				: "center"
	// Measure the displayed digits after fitting, then snap their center to the icon's pixels.
	// An odd pixel left over goes to the right: digits' ink sits right of their advance more
	// often than left (a leading "1"'s stem, a shadow cast down-right), and rounding the half
	// up would add a second pixel to the same side.
	const width = align === "center" ? advance(text, size, weight, family) : undefined
	const centerWidth = width !== undefined && width > 0 ? width : undefined
	target.Push({
		kind: "text",
		x:
			centerWidth === undefined
				? box.x
				: Math.round(box.x) +
					Math.floor((Math.round(box.Width) - centerWidth) / 2),
		y,
		w: centerWidth === undefined ? box.Width : Math.ceil(centerWidth),
		h: height,
		lineHeight: height,
		text,
		align: centerWidth === undefined ? align : "left",
		size,
		weight,
		family,
		color: MenuSDK.HudColor(color, 255),
		opacity: color.a / 255,
		effect: style.Effect.SelectedID,
		effectColor: MenuSDK.HudColor(style.EffectColor.SelectedColor, 255),
		effectOpacity: style.EffectOpacity.value / 100
	})
}

/**
 * How far `text` advances, summed a character at a time. A countdown reads a new string every
 * tick, and a string the measure cache has not seen yet comes back empty for a frame - the
 * reading would then be centred by the layout's own rounding and step a pixel aside each tick.
 * Its characters are a dozen at most, measured once and kept; digits do not kern.
 */
function advance(
	text: string,
	size: number,
	weight: number,
	family: string
): Nullable<number> {
	let width = 0
	for (let index = 0; index < text.length; index++) {
		const measured = MenuSDK.MeasureTextPx(text[index], size, weight, family)
		if (measured === undefined) {
			return undefined
		}
		width += measured[0]
	}
	return width
}
