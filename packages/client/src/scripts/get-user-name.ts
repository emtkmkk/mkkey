export default function (
	user: {
		name?: string | null;
		username: string;
	},
	excludeEmojis?: boolean,
): string {
	return user.name && excludeEmojis
		? user.name?.replaceAll(/\s?:[\w_]+?:/g, "")?.trim() || user.username
		: user.name || user.username;
}
