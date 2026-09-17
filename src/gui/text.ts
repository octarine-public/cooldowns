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
	const width =
		align === "center"
			? MenuSDK.MeasureTextPx(text, size, weight, family)?.[0]
			: undefined
	const centerWidth = width !== undefined && width > 0 ? width : undefined
	target.Push({
		kind: "text",
		x:
			centerWidth === undefined
				? box.x
				: Math.round(box.x) +
					Math.round((Math.round(box.Width) - centerWidth) / 2),
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
