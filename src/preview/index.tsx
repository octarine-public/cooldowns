import { MenuManager } from "../menu/index"
import { PreviewController } from "./controller"
import { DressPreview, PreviewScene } from "./scene"
import { PreviewFooter, PreviewHeader, PreviewStage } from "./view"

export function MountCooldownPreview(menu: MenuManager): void {
	const preview = new PreviewController(menu)
	MenuSDK.MountPreview({
		key: "cooldowns-preview",
		scene: PreviewScene,
		Shown: () => preview.IsShown(),
		Model: () => preview.Model(),
		Header: () => <PreviewHeader preview={preview} />,
		Footer: () => <PreviewFooter preview={preview} />,
		Stage: () => <PreviewStage preview={preview} />,
		Overflow: "visible",
		Frame: (x, y, w, h) => Object.assign(preview.Frame, { x, y, w, h }),
		Tick: (visible, width, height) => {
			DressPreview(preview.Wearables())
			preview.Tick(visible, width, height)
		}
	})
}
