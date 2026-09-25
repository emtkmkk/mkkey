/**
 * @file
 * Google フォームの過去の追加申請から、取り込む候補の一覧と、取り込み API に渡す内容を作る（手元用・一時的）。
 *
 * @remarks
 * TEMP: 移行が終わったら、このディレクトリごと削除する（計画書の手順 12）。
 *
 * 入力（input/ に置く。どちらも git に入れない）
 * - input/sheet.csv：回答シート「絵文字申請」を CSV で書き出したもの（メールアドレスとトークンの列を含むが、出力には書かない）
 * - input/notes.json：申請チャンネルのノートの一覧（notes.sql の結果）
 *
 * 出力（output/ に書く。git に入れない）
 * - output/candidates.md：確認用の一覧（取り込む候補と、除いたものとその理由）
 * - output/payload.json：API コンソールで admin/emoji-add-request/import-legacy に貼り付ける内容
 *
 * 対応づけ：申請チャンネルの「この絵文字を登録する(id:N)」のノートの row=N が、回答シートの N 行目（見出しが 1 行目）を指す。
 * 取り込む条件（計画書「過去の追加申請の移行」）
 * - 同じ名前のローカル絵文字が今は無い
 * - 同じ名前・同じ申請者が複数あれば、いちばん新しい 1 件だけ（D5）
 * - 画像がドライブに残っている
 *
 * 使い方：node scripts/emoji-legacy-import/build.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const inputDir = path.join(dir, "input");
const outputDir = path.join(dir, "output");

// #region CSV の読み込み

/**
 * CSV を行と列に分ける（ダブルクォートで囲んだ中の改行・カンマ・"" に対応）。
 *
 * @param {string} text - CSV の中身
 * @returns {string[][]} 行ごとの列
 */
function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') {
				quoted = false;
			} else {
				cell += c;
			}
		} else if (c === '"') {
			quoted = true;
		} else if (c === ",") {
			row.push(cell);
			cell = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += c;
		}
	}
	if (cell !== "" || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

// #endregion

// #region 値の変換

/** 回答シートの列名（フォームの質問の文） */
const COL = {
	timestamp: "タイムスタンプ",
	name: "絵文字名（ショートコード）",
	category: "カテゴリ",
	aliases: "タグ・エイリアス",
	licenseQ: "ライセンス情報を入力しますか？",
	copy: "他鯖へのコピー可否",
	license: "ライセンス",
	creator: "作者",
	usage: "使用情報",
	description: "説明",
	message: "他に特に書くことがあれば入力",
};

/** フォームの「他鯖へのコピー可否」の選択肢 → 保存する値 */
const COPY_PERMISSION = {
	決めない: "none",
	コピー可: "allow",
	"許可の後、コピー可": "ask",
	条件付きでコピー可: "conditional",
	コピー不可: "deny",
};

/**
 * フォームの送信時刻（日本時間の「2024/01/07 19:41:41」）を ISO 8601 にする。
 *
 * @param {string} s - 送信時刻
 * @returns {string | null} ISO 8601（読めなければ null）
 */
function toIso(s) {
	const m = s.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/);
	if (!m) return null;
	const p = (x) => x.padStart(2, "0");
	return new Date(`${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${m[5]}:${m[6]}+09:00`).toISOString();
}

/**
 * シートの 1 行を、取り込み API の 1 件にする。
 *
 * @param {Record<string, string>} r - 列名 → 値
 * @param {{ requester: string | null; fileId: string }} note - 対応するノート
 * @returns {object} 取り込み API の 1 件
 */
function toEntry(r, note) {
	const text = (v) => (v ?? "").trim() || null;
	const isTextOnly = (r[COL.licenseQ] ?? "").includes("文字だけ");
	const copy = COPY_PERMISSION[(r[COL.copy] ?? "").trim()] ?? "none";
	// 「許可の後、コピー可」のとき、フォームでは使用情報の欄に連絡先を書いてもらっていた（GAS と同じ扱い）
	const ask = copy === "ask";
	const license = text(r[COL.license]);
	return {
		name: r[COL.name].trim().toLowerCase(),
		submittedAt: toIso(r[COL.timestamp]),
		requesterUsername: note.requester,
		noteFileId: note.fileId,
		category: text(r[COL.category]),
		aliases: (r[COL.aliases] ?? "").split(/[\s　]+/).filter(Boolean),
		isTextOnly,
		description: text(r[COL.description]),
		message: text(r[COL.message]),
		...(isTextOnly
			? {}
			: {
					copyPermission: ask ? "conditional" : copy,
					askContact: ask ? text(r[COL.usage]) : null,
					usageInfo: ask ? null : text(r[COL.usage]),
					// 「CC BY-NC-SA 4.0 （もこチキ）」の補足は外す。「決めない」はライセンス無し
					licenseName: license && license !== "決めない" ? license.replace(/\s*（.*）$/, "") : null,
					creator: text(r[COL.creator]),
			  }),
	};
}

// #endregion

// #region 組み立て

const rows = parseCsv(fs.readFileSync(path.join(inputDir, "sheet.csv"), "utf8").replace(/^﻿/, ""));
const header = rows[0];
for (const k of Object.values(COL)) {
	if (!header.includes(k)) throw new Error(`回答シートに「${k}」の列がありません`);
}
/** @type {(n: number) => Record<string, string> | null} シートの N 行目（見出しが 1 行目） */
const sheetRow = (n) => (rows[n - 1] ? Object.fromEntries(header.map((h, i) => [h, rows[n - 1][i] ?? ""])) : null);

const notes = JSON.parse(fs.readFileSync(path.join(inputDir, "notes.json"), "utf8"));

const excluded = [];
const picked = new Map();
for (const n of notes) {
	const label = n.name ? `:${n.name}:` : "（名前なし）";
	if (n.localExists) continue; // 今は同じ名前の絵文字がある（承認済み）。一覧にも出さない
	if (n.name == null || n.row == null) {
		excluded.push({ label, requester: n.requester, reason: "シートの行と対応づけられない（「登録する」のノートが無い。初期のテスト送信など）" });
		continue;
	}
	const r = sheetRow(n.row);
	if (r == null || r[COL.name].trim().toLowerCase() !== n.name) {
		excluded.push({ label, requester: n.requester, reason: `シートの ${n.row} 行目と絵文字名が合わない` });
		continue;
	}
	if (!n.fileExists) {
		excluded.push({ label, requester: n.requester, reason: "画像がドライブに残っていない" });
		continue;
	}
	const key = `${n.name}\t${n.requester}`;
	const prev = picked.get(key);
	if (prev) {
		// 同じ名前・同じ申請者は新しい方だけ残す（D5）。ノートは古い順に並んでいる
		excluded.push({ label, requester: n.requester, reason: `同じ申請者の同じ名前の申請がある（${prev.note.row} 行目を除き、${n.row} 行目を残す）` });
	}
	picked.set(key, { note: n, entry: toEntry(r, { requester: n.requesterExists ? n.requester : null, fileId: n.fileId }) });
}

const candidates = [...picked.values()];

// #endregion

// #region 出力

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
	path.join(outputDir, "payload.json"),
	`${JSON.stringify({ entries: candidates.map((c) => c.entry) }, null, "\t")}\n`,
);

const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = [
	"# 過去の追加申請の取り込み候補",
	"",
	`取り込む候補：${candidates.length} 件／除いたもの：${excluded.length} 件`,
	"",
	"## 取り込む候補",
	"",
	"| 行 | 絵文字名 | 申請者 | 送信日時 | 文字だけ | コピー可否 | ライセンス | カテゴリ | タグ |",
	"| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
	...candidates.map(({ note, entry: e }) =>
		`| ${note.row} | :${esc(e.name)}: | ${esc(e.requesterUsername ?? "（不明）")} | ${esc(e.submittedAt)} | ${e.isTextOnly ? "はい" : ""} | ${esc(e.copyPermission ?? "")}${e.askContact ? `（連絡先 ${esc(e.askContact)}）` : ""} | ${esc(e.licenseName ?? "")} | ${esc(e.category ?? "")} | ${esc(e.aliases.join(" "))} |`,
	),
	"",
	"## 除いたもの",
	"",
	"| 絵文字名 | 申請者 | 理由 |",
	"| --- | --- | --- |",
	...excluded.map((x) => `| ${esc(x.label)} | ${esc(x.requester ?? "")} | ${esc(x.reason)} |`),
	"",
];
fs.writeFileSync(path.join(outputDir, "candidates.md"), lines.join("\n"));

console.log(`取り込む候補 ${candidates.length} 件、除いたもの ${excluded.length} 件`);
console.log(`→ ${path.join(outputDir, "candidates.md")}`);
console.log(`→ ${path.join(outputDir, "payload.json")}`);

// #endregion
