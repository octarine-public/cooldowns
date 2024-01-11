import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

import { BaseMenu } from "./base"

export class ItemMenu extends BaseMenu {
	constructor(node: Menu.Node) {
		super(node, "Items", true, undefined, ImageData.Paths.Icons.icon_svg_hamburger)
	}
}
