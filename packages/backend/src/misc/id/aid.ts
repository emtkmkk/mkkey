/**
 * @packageDocumentation
 *
 * AID（ノート等の一意識別子）の生成。2000/1/1 からの経過ミリ秒（base36・8文字）+ ノイズ（2文字）。
 *
 * @remarks
 * - **役割**: ノート・ユーザー等の ID を時系列で一意に生成し、API や AP で参照される。
 *
 * @see {@link models/entities/note} ノートエンティティ
 * @internal
 */
import * as crypto from "node:crypto";

const TIME2000 = 946684800000;
let counter = crypto.randomBytes(2).readUInt16LE(0);

function getTime(time: number) {
	time = time - TIME2000;
	if (time < 0) time = 0;

	return time.toString(36).padStart(8, "0");
}

function getNoise() {
	return counter.toString(36).padStart(2, "0").slice(-2);
}

/**
 * 日付から AID を生成する。
 * @param date - 基準日時
 * @returns AID 文字列
 * @throws 無効な Date の場合
 * @internal
 */
export function genAid(date: Date): string {
	const t = date.getTime();
	if (isNaN(t)) throw "Failed to create AID: Invalid Date";
	counter++;
	return getTime(t) + getNoise();
}
