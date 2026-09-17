import { HudCanvas } from "./src/gui/canvas"

/**
 * The one overlay every strip is drawn on - frames, icons and readings in a single pool of the
 * script's own elements, the way deadlock-esp draws its cells. The icons are `img` elements
 * minted at the whole-pixel size they stand at rather than a shared canvas cutting art to
 * cover a box, so what the preview shows is what the game draws.
 */
export const surface = new HudCanvas()

/**
 * The SDK's own canvas, for what is drawn the way teleport-esp draws its markers: a round
 * modifier is its circular timer, icon, ring and reading in one call. Its panel is registered
 * on the first draw, after the overlay's below, so a timer stands over anything the overlay
 * paints at the same spot.
 */
export const canvas = new MenuSDK.Canvas("cooldowns")

/**
 * The same for the preview: it stands with the menu, so its timers go out on the menu's layer,
 * at the preview's frame plus where the preview lays them out. Registered on the first draw,
 * after the preview card's own panels, so a timer stands over the stage.
 */
export const previewCanvas = new MenuSDK.Canvas(
	"cooldowns-preview",
	MenuSDK.EPanelLayer.Menu
)

MenuSDK.RegisterPanel(
	"cooldowns-overlay",
	() =>
		React.createElement("div", {
			ref: surface.Ref,
			style: {
				position: "absolute",
				left: "0px",
				top: "0px",
				zIndex: 1,
				pointerEvents: "none"
			}
		}),
	MenuSDK.EPanelLayer.World
)
