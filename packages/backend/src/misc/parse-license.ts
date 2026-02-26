/**
 * 既存の絵文字 license 文字列をパースし、個別カラム用の値と補足情報に分けるユーティリティ
 *
 * マイグレーションと手動パースかけ直し API の両方で利用する。
 * copyPermission は DB 保存形（a/d/c/n）で返す。
 *
 * @packageDocumentation
 */

import { toStoredCopyPermission } from "./copy-permission.js";

/** パース結果（新カラム用の値と補足情報） */
export interface ParsedLicense {
	/** コピー可否: DB 保存形 a | d | c | n */
	copyPermission: string | null;
	/** ライセンス名（「ライセンス : 」の値） */
	licenseName: string | null;
	usageInfo: string | null;
	/** 製作者（「作者 : 」または「製作者 : 」の値） */
	creator: string | null;
	description: string | null;
	isBasedOnUrl: string | null;
	/** パースで取り出した部分を除いた残り（ライセンス補足情報として license に格納） */
	remainder: string;
	/** 元の文字列が「文字だけ」のとき true */
	isTextOnly: boolean;
}

const RE_COPY = /コピー可否\s*:\s*(\w+)(?:,|$)/;
const RE_LICENSE = /ライセンス\s*:\s*([^,]+)(?:,|$)/;
const RE_USAGE = /使用情報\s*:\s*([^,]+)(?:,|$)/;
/** 作者 / 製作者 のいずれにも対応（後方互換） */
const RE_CREATOR = /(?:作者|製作者)\s*:\s*([^,]+)(?:,|$)/;
const RE_DESC = /説明\s*:\s*([^,]+)(?:,|$)/;
const RE_BASED = /コピー元\s*:\s*([^,]+)(?:,|$)/;

/**
 * 既存の license 文字列をパースし、個別フィールドと補足情報に分ける
 *
 * @param licenseStr - 既存の license カラムの値（null/undefined の場合はそのまま返す）
 * @returns パース成功時は ParsedLicense。パースできない・想定外フォーマットの場合は null（license は上書きせず新カラムは null のままにする）
 *
 * @remarks
 * 元が "文字だけ" のときは isTextOnly=true とし、copyPermission / licenseName / creator を固定値にした結果を返す（creator は DB には null で保存し、読み取り時に config.host で補う）。
 */
export function parseLicenseString(
	licenseStr: string | null | undefined,
): ParsedLicense | null {
	if (licenseStr == null || licenseStr === "") {
		return {
			copyPermission: null,
			licenseName: null,
			usageInfo: null,
			creator: null,
			description: null,
			isBasedOnUrl: null,
			remainder: "",
			isTextOnly: false,
		};
	}

	const trimmed = licenseStr.trim();

	// 文字だけ絵文字: 固定で返す。remainder は空にする。copyPermission は保存形で返す
	if (trimmed === "文字だけ") {
		return {
			copyPermission: toStoredCopyPermission("allow"),
			licenseName: "CC0 1.0 Universal",
			usageInfo: null,
			creator: null, // 読み取り時に config.host で補う
			description: null,
			isBasedOnUrl: null,
			remainder: "",
			isTextOnly: true,
		};
	}

	// 既知のパターンで抽出。1つもマッチしなければ想定外フォーマットとみなし null を返す
	const copyPermission = RE_COPY.exec(trimmed)?.[1] ?? null;
	const licenseName = RE_LICENSE.exec(trimmed)?.[1]?.trim() ?? null;
	const usageInfo = RE_USAGE.exec(trimmed)?.[1]?.trim() ?? null;
	const creator = RE_CREATOR.exec(trimmed)?.[1]?.trim() ?? null;
	const description = RE_DESC.exec(trimmed)?.[1]?.trim() ?? null;
	const isBasedOnUrl = RE_BASED.exec(trimmed)?.[1]?.trim() ?? null;

	// 少なくともいずれか1つは取り出せた場合のみ「パース成功」とする
	const hasAny =
		copyPermission != null ||
		licenseName != null ||
		usageInfo != null ||
		creator != null ||
		description != null ||
		isBasedOnUrl != null;

	if (!hasAny) {
		return null;
	}

	// 残り（補足情報）: 取り出したキー・値を除去した文字列
	let remainder = trimmed;
	for (const re of [RE_COPY, RE_LICENSE, RE_USAGE, RE_CREATOR, RE_DESC, RE_BASED]) {
		remainder = remainder.replace(re, "").replace(/,+\s*,/g, ",").trim();
	}
	remainder = remainder.replace(/^,\s*|\s*,$/g, "").trim();

	return {
		copyPermission: toStoredCopyPermission(copyPermission),
		licenseName,
		usageInfo,
		creator,
		description,
		isBasedOnUrl,
		remainder,
		isTextOnly: false,
	};
}
