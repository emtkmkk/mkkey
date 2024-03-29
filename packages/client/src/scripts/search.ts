import * as os from "@/os";
import { i18n } from "@/i18n";
import { mainRouter } from "@/router";

export async function search(channel?: string, user?: string) {
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

	if (!(channel || user) && q.startsWith("@") && !q.includes(" ")) {
		mainRouter.push(`/${q}`);
		return;
	}

	if (!(channel || user) && q.startsWith("#")) {
		mainRouter.push(`/tags/${encodeURIComponent(q.substr(1))}`);
		return;
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

	if (!(channel || user) && q.startsWith("https://")) {
		const promise = os.api("ap/show", {
			uri: q,
		});

		os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);

		const res = await promise;

		if (res.type === "User") {
			mainRouter.push(`/@${res.object.username}@${res.object.host}`);
		} else if (res.type === "Note") {
			mainRouter.push(`/notes/${res.object.id}`);
		}

		return;
	}

	mainRouter.push(
		`/search?q=${encodeURIComponent(q.replaceAll(/[　\s]/g, "+"))}${
			channel ? `&channel=${encodeURIComponent(channel)}` : ""
		}${user ? `&user=${encodeURIComponent(user)}` : ""}`,
	);
}
