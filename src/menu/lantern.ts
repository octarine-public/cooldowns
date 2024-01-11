import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

import { BaseMenu } from "./base"

export class LanternMenu extends BaseMenu {
	public readonly Size: Menu.Slider

	constructor(node: Menu.Node) {
		const nodeImage = ImageData.Paths.AbilityIcons + "/watcher_channel_png.vtex_c"
		super(node, "Watchers", true, undefined, nodeImage, 0)
		this.Size = this.Tree.AddSlider(
			"Additional size",
			0,
			0,
			18,
			1,
			"Additional timer size and hero image"
		)
	}
}
