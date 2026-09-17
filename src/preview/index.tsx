import { MenuManager } from "../menu/index"
import { PreviewController } from "./controller"
import { PreviewFooter, PreviewHeader, PreviewStage } from "./view"

export function MountCooldownPreview(menu: MenuManager): void {
	const preview = new PreviewController(menu)
	MenuSDK.MountPreview({
		key: "cooldowns-preview",
		scene: new MenuSDK.CPreviewScene(),
		Shown: () => preview.IsShown(),
		Model: () => undefined,
		Header: () => <PreviewHeader preview={preview} />,
		Footer: () => <PreviewFooter preview={preview} />,
		Stage: () => <PreviewStage preview={preview} />,
		Overflow: "visible",
		Frame: (x, y, w, h) => Object.assign(preview.Frame, { x, y, w, h }),
		Tick: (visible, width, height) => preview.Tick(visible, width, height)
	})
}
