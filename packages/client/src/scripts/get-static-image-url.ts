import { url as instanceUrl } from "@/config";
import * as url from "@/scripts/url";

export function getStaticImageUrl(baseUrl: string): string {
	const u = baseUrl.startsWith('http') ? new URL(baseUrl) : new URL(baseUrl, instanceUrl);
	if (u.href.startsWith(`${instanceUrl}/emoji/`)) {
		// もう既にemojiっぽそうだったらsearchParams付けるだけ
		u.searchParams.set('static', '1');
		return u.href;
	}
	if (u.href.startsWith(`${instanceUrl}/proxy/`)) {
		// もう既にproxyっぽそうだったらsearchParams付けるだけ
		u.searchParams.set("static", "1");
		return u.href;
	}
	const dummy = "static.webp"; // 拡張子がないとキャッシュしてくれないCDNがあるので
	return `${instanceUrl}/proxy/${dummy}?${url.query({
		url: u.href,
		static: "1",
	})}`;
}
