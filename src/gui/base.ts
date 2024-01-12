import {
	DOTAGameState,
	DOTAGameUIState,
	GameRules,
	GameState
} from "github.com/octarine-public/wrapper/index"

export class BaseGUI {
	public get IsPostGame() {
		return (
			GameRules === undefined ||
			GameRules.GameState === DOTAGameState.DOTA_GAMERULES_STATE_POST_GAME
		)
	}

	public get IsInGameUI() {
		return GameState.UIState === DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME
	}
}
