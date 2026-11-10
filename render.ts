import { HudCanvas, SurfaceText } from "./src/gui/canvas"
import { SharedTimers, StripTimers } from "./src/gui/timers"

/**
 * The one overlay every strip is drawn on - frames, icons and readings as the script's own
 * elements, the way deadlock-esp draws its cells, each strip in a container of its own that
 * moves with it. The icons are `img` elements minted at the whole-pixel size they stand at
 * rather than a shared canvas cutting art to cover a box, so what the preview shows is what the
 * game draws.
 */
export const surface = new HudCanvas(true)

/**
 * The SDK's own canvas, for what is drawn the way teleport-esp draws its markers: a round
 * modifier uses the same circular timer component, with readings sized like item text, on a
 * surface of its strip's own, so a strip that has not changed is only moved after its bar. Each
 * panel is registered on its strip's first draw, after the overlay's below, so a timer stands
 * over anything the overlay paints at the same spot.
 */
export const timers = new StripTimers("cooldowns-timers")

/**
 * The same for the preview: it stands with the menu, so its timers go out on the menu's layer,
 * at the preview's frame plus where the preview lays them out. A surface on that layer stands
 * over the menu's own panels, so a timer shows over the stage rather than under the card.
 */
export const previewTimers = new SharedTimers(
	new MenuSDK.Canvas("cooldowns-preview", MenuSDK.EPanelLayer.Menu),
	new SurfaceText(MenuSDK.HudSurfaceOf("cooldowns-preview", MenuSDK.EPanelLayer.Menu))
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
