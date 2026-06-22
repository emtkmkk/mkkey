/**
 * @packageDocumentation
 *
 * プライベート IP 判定ユーティリティ。SSRF 対策の共通判定をまとめる。
 *
 * @remarks
 * - **役割**: 取得先 IP がプライベート/ローカルなアドレスかを判定し、SSRF を防ぐ。
 * - `config.allowedPrivateNetworks` に含まれる CIDR は明示的に許可する（例: 信頼できる内部ストレージ）。
 * - `download-url` / `fetch` / `upload-from-url` 等から共通利用する。
 *   （`fetch.ts` ← `download-url.ts` の循環インポートを避けるため、独立モジュールに切り出している）
 *
 * @internal
 */
import IPCIDR from "ip-cidr";
import PrivateIp from "private-ip";
import config from "@/config/index.js";

/**
 * 指定 IP がプライベート/ローカルアドレスかを判定する。
 *
 * @remarks
 * `config.allowedPrivateNetworks` に含まれる CIDR は許可（false 扱い）とする。
 *
 * @param ip - 判定対象の IP アドレス文字列
 * @returns プライベート IP の場合 true（ただし許可リストに含まれる場合は false）
 * @internal
 */
export function isPrivateIp(ip: string): boolean {
	for (const net of config.allowedPrivateNetworks || []) {
		const cidr = new IPCIDR(net);
		if (cidr.contains(ip)) {
			return false;
		}
	}

	return PrivateIp(ip);
}
