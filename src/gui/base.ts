import {
	DOTAGameState,
	DOTAGameUIState,
	GameRules,
	GameState,
	GUIInfo,
	Input,
	Rectangle,
	Vector2
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

	public IsDotaHUDPosition(panelPosition: Vector2) {
		return (
			this.isShop(panelPosition) ||
			this.isTopBar(panelPosition) ||
			this.isMiniMap(panelPosition) ||
			this.isScoreboard(panelPosition) ||
			this.isShopButtons(panelPosition) ||
			this.isLowerHUD(panelPosition)
		)
	}

	public ShouldPosition(panelPosition: Vector2, ...positions: Rectangle[]) {
		return positions.some(position => this.isContainsPanel(panelPosition, position))
	}

	private isTopBar(panelPosition: Vector2) {
		const topBar = GUIInfo.TopBar
		return this.ShouldPosition(
			panelPosition,
			topBar.TimeOfDay,
			topBar.DireTeamScore,
			topBar.RadiantTeamScore,
			topBar.TimeOfDayTimeUntil,
			...topBar.DirePlayersHeroImages,
			...topBar.RadiantPlayersHeroImages
		)
	}

	private isLowerHUD(panelPosition: Vector2) {
		const lowerHUD = GUIInfo.GetLowerHUDForUnit()
		if (lowerHUD === undefined) {
			return false
		}
		return this.ShouldPosition(
			panelPosition,
			lowerHUD.XP,
			lowerHUD.TPSlot,
			lowerHUD.Portrait,
			lowerHUD.LeftFlare,
			lowerHUD.TalentTree,
			lowerHUD.RightFlare,
			lowerHUD.NeutralSlot,
			lowerHUD.StatsContainer,
			lowerHUD.AbilitiesContainer,
			lowerHUD.InventoryContainer,
			lowerHUD.HealthManaContainer,
			lowerHUD.NeutralAndTPContainer,
			...lowerHUD.AbilitiesRects
		)
	}

	private isShop(panelPosition: Vector2) {
		if (!Input.IsShopOpen) {
			return false
		}
		return this.ShouldPosition(
			panelPosition,
			//  Shop
			GUIInfo.Shop.Stash,
			GUIInfo.Shop.StashGrabAll,
			//  OpenShopMini
			GUIInfo.OpenShopMini.Items,
			GUIInfo.OpenShopMini.Header,
			GUIInfo.OpenShopMini.GuideFlyout,
			GUIInfo.OpenShopMini.ItemCombines,
			GUIInfo.OpenShopMini.PinnedItems,
			//  OpenShopLarge
			GUIInfo.OpenShopLarge.Items,
			GUIInfo.OpenShopLarge.Header,
			GUIInfo.OpenShopLarge.GuideFlyout,
			GUIInfo.OpenShopLarge.PinnedItems,
			GUIInfo.OpenShopLarge.ItemCombines
		)
	}

	private isShopButtons(panelPosition: Vector2) {
		return this.ShouldPosition(
			panelPosition,
			GUIInfo.Shop.ShopButton,
			GUIInfo.Shop.CourierGold,
			GUIInfo.Shop.Sticky1Row,
			GUIInfo.Shop.Sticky2Rows,
			GUIInfo.Shop.Quickbuy1Row,
			GUIInfo.Shop.Quickbuy2Rows,
			GUIInfo.Shop.ClearQuickBuy1Row,
			GUIInfo.Shop.ClearQuickBuy2Rows
		)
	}

	private isMiniMap(panelPosition: Vector2) {
		return this.ShouldPosition(
			panelPosition,
			GUIInfo.Minimap.Minimap,
			GUIInfo.Minimap.MinimapRenderBounds,
			GUIInfo.Minimap.Glyph,
			GUIInfo.Minimap.Scan
		)
	}

	private isScoreboard(panelPosition: Vector2) {
		if (!Input.IsScoreboardOpen) {
			return false
		}
		return this.ShouldPosition(panelPosition, GUIInfo.Scoreboard.Background)
	}

	private isContainsPanel(panelPosition: Vector2, position: Rectangle) {
		return position.Contains(panelPosition)
	}
}
