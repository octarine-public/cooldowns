import { CooldownIcons } from "../menu/icons"
import { PreviewController } from "./controller"
import { PreviewGroup } from "./group"

const hint =
	"Drag to move · Wheel to resize · Ctrl + wheel for text · Right-click for settings"
const anchorHint = "Right-click for preview settings"
const localize = (text: string) => MenuSDK.Localization.Localize(text)

function showGroupHint(group: PreviewGroup, anchor: HTMLElement): void {
	const size = group.Menu.Size
	MenuSDK.ShowChipTooltip(
		anchor,
		`${localize(group.Label)} · ${size.value}${size.Suffix}`,
		"top",
		localize(hint)
	)
}

export function PreviewHeader({ preview }: { preview: PreviewController }) {
	return (
		<React.Fragment>
			<MenuSDK.StageChip
				icon={Menu.Icons.Settings2}
				label="General"
				on={MenuSDK.ElementSettingsNode() === preview.Menu.General}
				press={() => preview.Open(preview.Menu.General)}
			/>
			<MenuSDK.StageChip
				icon={Menu.Icons.Type}
				label="Style"
				on={MenuSDK.ElementSettingsNode() === preview.Menu.Style.Node}
				press={() => preview.Open(preview.Menu.Style.Node)}
			/>
			<MenuSDK.StageChip
				icon={CooldownIcons.Heroes}
				label="Preview"
				on={MenuSDK.ElementSettingsNode() === preview.Node}
				press={() => preview.Open(preview.Node)}
			/>
		</React.Fragment>
	)
}

function GroupChip({
	preview,
	group
}: {
	preview: PreviewController
	group: PreviewGroup
}) {
	const active = preview.IsEnabled(group)
	return (
		<div
			style={{
				...MenuSDK.ChipFrame(active, 9),
				width: 30,
				height: 30,
				marginRight: 7,
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			}}
			onMouseUp={event => {
				if (event.data.button === 0) {
					preview.Toggle(group)
				} else if (event.data.button === 1) {
					MenuSDK.HideChipTooltip(event.currentTarget)
					preview.Drag.Configure(group)
				}
				event.stopPropagation()
			}}
			onMouseOver={event => {
				if (event.target === event.currentTarget) {
					MenuSDK.ShowChipTooltip(
						event.currentTarget,
						localize(group.Label),
						"top"
					)
				}
			}}
			onMouseOut={event => {
				if (event.target === event.currentTarget) {
					MenuSDK.HideChipTooltip(event.currentTarget)
				}
			}}
		>
			<MenuSDK.Icon
				path={group.Icon}
				size={16}
				tint={active ? MenuSDK.Tokens.Accent : MenuSDK.Tokens.TextDim}
			/>
		</div>
	)
}

export function PreviewFooter({ preview }: { preview: PreviewController }) {
	return (
		<div
			style={{
				padding: 10,
				borderTopWidth: "1px",
				borderTopColor: MenuSDK.Tokens.GlassBorder
			}}
		>
			<div style={{ display: "flex", alignItems: "center" }}>
				{preview.Groups.filter(group => group.Settings !== undefined).map(
					group => (
						<GroupChip key={group.Label} preview={preview} group={group} />
					)
				)}
				<div
					style={{
						flex: "1 1 auto",
						textAlign: "right",
						fontSize: 11,
						color: MenuSDK.Tokens.TextMuted
					}}
				>
					<div>{localize(preview.Unit.values[preview.Unit.SelectedID])}</div>
					<div>{localize(preview.Team.values[preview.Team.SelectedID])}</div>
				</div>
			</div>
		</div>
	)
}

export function PreviewStage({ preview }: { preview: PreviewController }) {
	return (
		<React.Fragment>
			<div
				ref={preview.AnchorRef}
				style={{
					position: "absolute",
					pointerEvents: "none"
				}}
			/>
			<div
				ref={preview.Silence.Ref}
				style={{
					position: "absolute",
					pointerEvents: "none"
				}}
			/>
			{preview.Groups.map(group => (
				<div
					key={group.Label}
					ref={group.Canvas.Ref}
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						width: "100%",
						height: "100%",
						pointerEvents: "none"
					}}
				/>
			))}
			{preview.Groups.map(group => (
				<div
					key={`${group.Label}-drag`}
					ref={group.AreaRef}
					style={{
						position: "absolute",
						display: "none",
						pointerEvents: "auto"
					}}
					onMouseOver={event => {
						if (event.target !== event.currentTarget) {
							return
						}
						group.Hovered = true
						showGroupHint(group, event.currentTarget)
					}}
					onMouseOut={event => {
						if (event.target !== event.currentTarget) {
							return
						}
						group.Hovered = false
						MenuSDK.HideChipTooltip(event.currentTarget)
					}}
					onMouseDown={event => preview.Drag.Begin(group, event)}
					onMouseUp={event => {
						if (event.data.button === 1) {
							MenuSDK.HideChipTooltip(event.currentTarget)
							preview.Drag.Configure(group)
							event.stopPropagation()
						}
					}}
					onMouseScroll={event => {
						preview.Drag.Resize(group, event)
						if (group.Hovered && !preview.Drag.Active) {
							showGroupHint(group, event.currentTarget)
						}
					}}
				/>
			))}
			<div
				ref={preview.AnchorAreaRef}
				style={{
					position: "absolute",
					display: "none",
					pointerEvents: "auto"
				}}
				onMouseOver={event => {
					if (event.target === event.currentTarget) {
						preview.AnchorHovered = true
						MenuSDK.ShowChipTooltip(
							event.currentTarget,
							localize("HP bar"),
							"top",
							localize(anchorHint)
						)
					}
				}}
				onMouseOut={event => {
					if (event.target === event.currentTarget) {
						preview.AnchorHovered = false
						MenuSDK.HideChipTooltip(event.currentTarget)
					}
				}}
				onMouseUp={event => {
					if (event.data.button === 1) {
						MenuSDK.HideChipTooltip(event.currentTarget)
						preview.Open(preview.Node)
						event.stopPropagation()
					}
				}}
			/>
			<div
				ref={preview.Guides.Ref}
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: "100%",
					height: "100%",
					overflow: "hidden",
					pointerEvents: "none"
				}}
			/>
		</React.Fragment>
	)
}
