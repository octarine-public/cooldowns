import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

import { BaseMenu } from "./base"

export class RespawnMenu extends BaseMenu {
	constructor(node: Menu.Node) {
		super(node, "Respawn", true, undefined, ImageData.Paths.Icons.icon_svg_duration)
	}
}
