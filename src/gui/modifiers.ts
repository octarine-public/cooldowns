import { GUIInfo, Modifier, Vector2 } from "github.com/octarine-public/wrapper/index"

import { ModifierMenu } from "../menu/modifiers"
import { BaseGUI } from "./index"

export class ModifierGUI extends BaseGUI {
	private static readonly minSize = 16
	private readonly size = new Vector2()

	public Update(
		healthBarPosition: Vector2,
		healthBarSize: Vector2,
		additionalSize: number
	): void {
		super.Update(healthBarPosition, healthBarSize, additionalSize)
		const size = ModifierGUI.minSize + additionalSize
		this.size.CopyFrom(GUIInfo.ScaleVector(size, size))
	}

	public Draw(
		menu: ModifierMenu,
		modifiers: Modifier[],
		_additionalPosition: Vector2
	): void {
		const newModifiers = this.GetModifiers(modifiers)

		for (let index = newModifiers.length - 1; index > -1; index--) {
			const modifier = newModifiers[index]
		}
	}

	private GetModifiers(modifiers: Modifier[]): Modifier[] {
		return modifiers // TODO
	}
}
