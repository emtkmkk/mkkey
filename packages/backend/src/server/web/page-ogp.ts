/**
 * @packageDocumentation
 *
 * もこきーの画面の HTML に出すタイトル・説明・画像（OGP）を、URL から決める。
 *
 * @remarks
 * 投稿・ユーザー・クリップなど専用の OGP を持つ画面は、それぞれの専用のルートが出す。
 * ここでは、それ以外の画面（最後の受け皿のルートで返す画面）に、どの画面かが分かる OGP を付ける。
 * - 画面名は、クライアントのビルド時に作られた表（`built/_client_dist_/route-titles.json`）から引く
 *   （{@link resolveRouteTitle}）。表が無い（開発中など）ときは何もしない
 * - 絵文字の情報の画面（`/emoji_dialog/…`・`/emoji_license/…`）は、絵文字の名前・作者・ライセンスと、絵文字そのものの画像を出す
 * - 表に無い画面は null（呼び出し側で今までどおりサーバー全体の説明を出す）
 * 出すのは画面名と、誰でも見られる絵文字の情報だけ。本人しか見られない画面（申請の詳細など）でも、中身は出さない。
 *
 * @internal
 */
import { readFileSync } from "node:fs";
import { IsNull } from "typeorm";
import { Emojis } from "@/models/index.js";
import { resolveRouteTitle, type RouteTitleTable } from "@/misc/route-title.js";

/** 画面の HTML に出す OGP */
export type PageOgp = {
	title: string;
	desc: string;
	img: string | null;
};

/** 読み込んだ画面名の表（読めなかったときは null。一度だけ読む） */
let table: RouteTitleTable | null | undefined;

/**
 * 画面名の表を読む（クライアントを組み直したらサーバーも再起動するので、最初の一度だけ読む）。
 *
 * @param assetsDir - クライアントのビルドの出力先（末尾に / を付ける）
 * @returns 表（無ければ null）
 */
function loadTable(assetsDir: string): RouteTitleTable | null {
	if (table !== undefined) return table;
	try {
		table = JSON.parse(readFileSync(`${assetsDir}route-titles.json`, "utf-8")) as RouteTitleTable;
	} catch {
		table = null;
	}
	return table;
}

/**
 * 絵文字の情報の画面の OGP を作る。
 *
 * @param emoji - 絵文字の名前（`name` か `name@host`）
 * @param instanceName - サーバーの名前
 * @returns OGP（絵文字が無ければ null）
 */
async function buildEmojiOgp(emoji: string, instanceName: string): Promise<PageOgp | null> {
	const [name, host] = emoji.split("@");
	if (!/^[\w-]+$/.test(name)) return null;
	const e = await Emojis.findOneBy({
		name,
		host: host == null || host === "." || host === "" ? IsNull() : host,
	});
	if (e == null) return null;

	const display = e.alternateName ? (e.ruby ? `${e.alternateName}（${e.ruby}）` : e.alternateName) : null;
	// 文字だけの絵文字は、ライセンスを固定で扱っている（詳細画面と同じ）
	const license = e.isTextOnly ? "CC0 1.0 Universal" : e.licenseName;
	const lines = [
		display ? `表示名: ${display}` : null,
		e.creator && !e.isTextOnly ? `作者: ${e.creator}` : null,
		license ? `ライセンス: ${license}` : null,
		e.description ? `説明: ${e.description}` : null,
	].filter((x): x is string => x != null);

	const code = `:${e.name}${e.host ? `@${e.host}` : ""}:`;
	return {
		title: `${code}${e.alternateName ? ` ${e.alternateName}` : ""} の絵文字情報 | ${instanceName}`,
		desc: lines.length > 0 ? lines.join("\n") : `${instanceName}の絵文字 ${code} の情報です`,
		img: e.publicUrl || e.originalUrl || null,
	};
}

/**
 * URL から、その画面の OGP を決める。
 *
 * @param assetsDir - クライアントのビルドの出力先（末尾に / を付ける）
 * @param pathname - URL のパス
 * @param search - URL のクエリ
 * @param instanceName - サーバーの名前
 * @param privateMode - 非公開モードか（そのときは絵文字の情報を出さない）
 * @returns OGP（表に無い画面なら null）
 * @internal
 */
export async function resolvePageOgp(
	assetsDir: string,
	pathname: string,
	search: string,
	instanceName: string,
	privateMode: boolean,
): Promise<PageOgp | null> {
	const t = loadTable(assetsDir);
	if (t == null) return null;
	const match = resolveRouteTitle(t, pathname, search);
	if (match == null) return null;
	if (match.kind === "emoji") return privateMode ? null : await buildEmojiOgp(match.emoji, instanceName);
	return {
		title: `${match.label} | ${instanceName}`,
		desc: `${instanceName}の「${match.label}」の画面です`,
		img: null,
	};
}
