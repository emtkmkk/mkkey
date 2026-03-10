import * as os from "@/os";
import { i18n } from "@/i18n";
import { mainRouter } from "@/router";
import { $i } from "@/account";
import { pleaseLogin } from "@/scripts/please-login";

type LookupTarget =
	| { type: "user"; path: string }
	| { type: "tag"; path: string }
	| { type: "emoji"; path: string; name: string; host?: string }
	| { type: "uri"; uri: string };

function getLookupTarget(q: string): LookupTarget | null {
	if (q.startsWith("@") && !q.includes(" ")) {
		return {
			type: "user",
			path: `/${q}`,
		};
	}

	if (q.startsWith("#")) {
		return {
			type: "tag",
			path: `/tags/${encodeURIComponent(q.slice(1))}`,
		};
	}

	const emojiMatch = q.match(/^:([^\s:@]+)@([^\s:@]+):$/);
	if (emojiMatch) {
		const emojiName = emojiMatch[1];
		const emojiHost = emojiMatch[2];
		const emojiCode = `:${emojiName}${emojiHost ? `@${emojiHost}` : ""}:`;

		return {
			type: "emoji",
			name: emojiName,
			host: emojiHost,
			path: `/emoji/${encodeURIComponent(emojiCode)}`,
		};
	}

	if (q.startsWith("https://")) {
		return {
			type: "uri",
			uri: q,
		};
	}

	return null;
}

async function execLookup(lookupTarget: LookupTarget): Promise<boolean> {
	if (lookupTarget.type === "uri") {
		const promise = os.api("ap/show", {
			uri: lookupTarget.uri,
		});

		os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);

		const res = await promise;

		if (res.type === "User") {
			mainRouter.push(`/@${res.object.username}@${res.object.host}`);
			return true;
		}

		if (res.type === "Note") {
			mainRouter.push(`/notes/${res.object.id}`);
			return true;
		}

		return false;
	}

	if (lookupTarget.type === "emoji") {
		try {
			await os.apiGet("emoji", {
				name: lookupTarget.name,
				...(lookupTarget.host ? { host: lookupTarget.host } : {}),
			});
		} catch {
			return false;
		}

		mainRouter.push(lookupTarget.path);
		return true;
	}

	mainRouter.push(lookupTarget.path);
	return true;
}

export async function search(channel?: string, user?: string) {
	if (!$i) {
		pleaseLogin(window.location.href);
		return;
	}

	const { canceled, result: query } = await os.inputText({
		title: channel
			? i18n.ts.channelSearch
			: user
			? i18n.ts.userSearch
			: i18n.ts.search,
		default:
			new URLSearchParams(document.location.search)
				?.get("q")
				?.replaceAll("+", " ") || undefined,
	});
	if (canceled || query == null || query === "") return;

	const q = query.trim();

	if (!(channel || user)) {
		const lookupTarget = getLookupTarget(q);

		if (lookupTarget) {
			const { canceled: lookupCanceled } = await os.confirm({
				title: i18n.ts.lookup,
				text: i18n.ts.searchLookupConfirm,
				okText: i18n.ts.yes,
				cancelText: i18n.ts.no,
			});

			if (!lookupCanceled) {
				if (await execLookup(lookupTarget)) {
					return;
				}
			}
		}
	}

	// like 2018/03/12
	if (/^[0-9]{4}\/[0-9]{2}\/[0-9]{2}/.test(q.replace(/-/g, "/"))) {
		const date = new Date(q.replace(/-/g, "/"));

		// 日付しか指定されてない場合、例えば 2018/03/12 ならユーザーは
		// 2018/03/12 のコンテンツを「含む」結果になることを期待するはずなので
		// 23時間59分進める(そのままだと 2018/03/12 00:00:00 「まで」の
		// 結果になってしまい、2018/03/12 のコンテンツは含まれない)
		if (q.replace(/-/g, "/").match(/^[0-9]{4}\/[0-9]{2}\/[0-9]{2}$/)) {
			date.setHours(23, 59, 59, 999);
		}

		// TODO
		//v.$root.$emit('warp', date);
		os.alert({
			icon: "ph-clock-counter-clockwise ph-bold ph-lg",
			iconOnly: true,
			autoClose: true,
		});
		return;
	}

	mainRouter.push(
		`/search?q=${encodeURIComponent(q.replaceAll(/[　\s]/g, "+"))}${
			channel ? `&channel=${encodeURIComponent(channel)}` : ""
		}${user ? `&user=${encodeURIComponent(user)}` : ""}`,
	);
}
