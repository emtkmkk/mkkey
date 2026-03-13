/**
 * @packageDocumentation
 *
 * IP アドレスをハッシュ化する。同一人物が複数 IPv6 を持つことを考慮し /64 プレフィックスで正規化する。
 *
 * @remarks
 * - **役割**: レート制限・不正検知等で同一ユーザー判定に用いるハッシュを生成する。
 *
 * @internal
 */
import IPCIDR from "ip-cidr";

/**
 * IP を /64 プレフィックスで正規化しハッシュ文字列を返す（IPv4 はアドレス全体を使用）。
 * @param ip - IP アドレス文字列
 * @returns ip- プレフィックス付きハッシュ
 * @internal
 */
export function getIpHash(ip: string) {
	try {
		const prefix = IPCIDR.createAddress(ip).mask(64);
		return `ip-${BigInt(`0b${prefix}`).toString(36)}`;
	} catch (e) {
		const prefix = IPCIDR.createAddress(ip.replace(/:[0-9]+$/, "")).mask(64);
		return `ip-${BigInt(`0b${prefix}`).toString(36)}`;
	}
}
