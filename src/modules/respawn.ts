import {
	Color,
	PlayerCustomData,
	RendererSDK,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { RespawnGUI } from "../gui/respawn"
import { RespawnMenu } from "../menu/respawn"

export class RespawnManager {
	private readonly gui = new RespawnGUI()

	constructor(private readonly menu: RespawnMenu) {}

	public Draw() {
		if (!this.menu.State.value || this.gui.IsPostGame || !this.gui.IsInGameUI) {
			return
		}
		const arr = PlayerCustomData.Array
		for (let index = arr.length - 1; index > -1; index--) {
			const player = arr[index]
			if (!player.IsValid || player.IsSpectator || !player.IsEnemy()) {
				continue
			}

			const hero = player.Hero,
				respawnPos = player.RespawnPosition

			if (hero === undefined || respawnPos === undefined) {
				continue
			}

			// TODO: move to gui
			const texture = hero.TexturePath()
			const w2s = RendererSDK.WorldToScreen(respawnPos)
			if (w2s === undefined || texture === undefined) {
				continue
			}

			const size = new Vector2(64, 64)

			RendererSDK.Image(
				texture,
				w2s.Subtract(size.DivideScalar(2)),
				-1,
				size,
				Color.White
			)
		}
	}
}
