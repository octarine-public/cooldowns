import { Unit } from "github.com/octarine-public/wrapper/index"

import { SpellGUI } from "../gui/spells"
import { MenuManager } from "../menu"

export class SpellManager {
	// TODO: after capture spells and items
	private readonly gui = new SpellGUI()

	constructor(private readonly menu: MenuManager) {}

	private get state() {
		return this.menu.State.value
	}

	public Draw() {
		if (!this.state || this.gui.IsPostGame || !this.gui.IsInGameUI) {
			/** @todo */
		}
	}

	public UnitPropertyChanged(_unit: Unit) {
		/** @todo */
	}
}
