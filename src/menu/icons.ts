const iconsPath = `${__OCT_PACKAGE_ROOT__}/scripts_files/cooldowns/icons`

export const CooldownIcons = {
	Cooldowns: Menu.Icons.Timer,
	General: Menu.Icons.Settings2,
	Spells: Menu.Icons.Zap,
	Items: Menu.Icons.ItemList,
	Modifiers: Menu.Icons.SquareStack,
	Important: Menu.Icons.CircleAlert,
	Auras: `${iconsPath}/auras.svg`,
	Buffs: Menu.Icons.ShieldCheck,
	Debuffs: Menu.Icons.Ban,
	Heroes: `${iconsPath}/heroes.svg`,
	Creeps: `${iconsPath}/creeps.svg`,
	Bear: `${iconsPath}/bear.svg`,
	Courier: `${iconsPath}/courier.svg`,
	Roshan: `${iconsPath}/roshan.svg`,
	Familiars: `${iconsPath}/familiars.svg`,
	Pandas: `${iconsPath}/pandas.svg`
} as const
