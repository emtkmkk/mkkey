/**
 * @packageDocumentation
 *
 * `emoji-add-request-fields`（絵文字の追加申請の入力検査・値の組み立て）の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	appendHistory,
	applyAskContactRule,
	buildEmojiRowFromRequest,
	describeChangedFields,
	diffEditableFields,
	findEmojiAddRequestProblem,
	normalizeEmojiAddRequestFields,
} from "../../src/misc/emoji-add-request-fields.js";
import type {
	EmojiAddRequest,
	EmojiAddRequestEditableFields,
} from "../../src/models/entities/emoji-add-request.js";

/** テスト用の、全項目がそろった申請の値 */
function baseFields(over: Partial<EmojiAddRequestEditableFields> = {}): EmojiAddRequestEditableFields {
	return {
		name: "yorosiku",
		alternateName: null,
		ruby: null,
		description: null,
		category: null,
		aliases: [],
		sensitive: false,
		isTextOnly: false,
		motifSelf: false,
		motifUserMode: null,
		copyPermission: "allow",
		askContact: null,
		licenseName: "CC BY 4.0",
		creator: "@emtk@mkkey.net",
		usageInfo: null,
		copyrightNotice: null,
		creditText: null,
		relatedLinks: [],
		fileId: "file1",
		...over,
	};
}

/** テスト用の申請の行 */
function baseRequest(over: Partial<EmojiAddRequestEditableFields> = {}): EmojiAddRequest {
	return { ...baseFields(over), requesterId: "user1" } as unknown as EmojiAddRequest;
}

const file = { url: "https://s3/o.png", webpublicUrl: "https://s3/w.webp", type: "image/png", webpublicType: "image/webp" };

describe("emoji-add-request-fields", () => {
	describe("normalizeEmojiAddRequestFields", () => {
		it("正常系：名前は小文字にし、空白だけの文字列は null にする", () => {
			const out = normalizeEmojiAddRequestFields({ name: " YoroSiku ", alternateName: "  ", ruby: " よろしく " });
			assert.strictEqual(out.name, "yorosiku");
			assert.strictEqual(out.alternateName, null);
			assert.strictEqual(out.ruby, "よろしく");
		});

		it("正常系：タグは空白（全角も）で分け、重複を除く", () => {
			const out = normalizeEmojiAddRequestFields({ aliases: ["よろしく　おねがい", "よろしく"] });
			assert.deepStrictEqual(out.aliases, ["よろしく", "おねがい"]);
		});

		it("境界値：省略した項目は結果に含めない（修正案で変えた項目だけを扱うため）", () => {
			const out = normalizeEmojiAddRequestFields({ category: "挨拶" });
			assert.deepStrictEqual(Object.keys(out), ["category"]);
		});
	});

	describe("findEmojiAddRequestProblem", () => {
		it("正常系：問題が無ければ null", () => {
			assert.strictEqual(findEmojiAddRequestProblem(baseFields()), null);
		});

		it("異常系：名前に a-z・0-9・_ 以外があれば invalidName", () => {
			assert.strictEqual(findEmojiAddRequestProblem(baseFields({ name: "よろしく" })), "invalidName");
			assert.strictEqual(findEmojiAddRequestProblem(baseFields({ name: "a-b" })), "invalidName");
		});

		it("異常系：文字だけの絵文字でないのにモチーフが未回答なら motifRequired", () => {
			assert.strictEqual(findEmojiAddRequestProblem(baseFields({ motifSelf: null })), "motifRequired");
		});

		it("正常系：文字だけの絵文字ならモチーフが未回答でもよい", () => {
			assert.strictEqual(findEmojiAddRequestProblem(baseFields({ isTextOnly: true, motifSelf: null })), null);
		});

		it("異常系：条件付きで連絡先も使用情報も無ければ usageInfoRequired", () => {
			assert.strictEqual(
				findEmojiAddRequestProblem(baseFields({ copyPermission: "conditional" })),
				"usageInfoRequired",
			);
		});

		it("正常系：条件付きでも連絡先があれば使用情報は無くてよい（許可の後、コピー可）", () => {
			assert.strictEqual(
				findEmojiAddRequestProblem(baseFields({ copyPermission: "conditional", askContact: "@a@b" })),
				null,
			);
		});
	});

	describe("applyAskContactRule", () => {
		it("正常系：連絡先があればコピー可否を conditional にする", () => {
			const out = applyAskContactRule(baseFields({ copyPermission: "allow", askContact: "@a@b" }));
			assert.strictEqual(out.copyPermission, "conditional");
		});

		it("正常系：文字だけの絵文字はモチーフと連絡先を消す", () => {
			const out = applyAskContactRule(baseFields({ isTextOnly: true, motifSelf: true, motifUserMode: "owner", askContact: "@a@b" }));
			assert.strictEqual(out.motifSelf, null);
			assert.strictEqual(out.motifUserMode, null);
			assert.strictEqual(out.askContact, null);
		});

		it("正常系：自分がモチーフで利用範囲が無ければ any にし、モチーフでなければ利用範囲を消す", () => {
			assert.strictEqual(applyAskContactRule(baseFields({ motifSelf: true })).motifUserMode, "any");
			assert.strictEqual(applyAskContactRule(baseFields({ motifSelf: false, motifUserMode: "owner" })).motifUserMode, null);
		});
	});

	describe("diffEditableFields / describeChangedFields", () => {
		it("正常系：変わった項目だけを返し、表示名をつないだ文にできる", () => {
			const before = baseFields();
			const after = baseFields({ name: "yorosiku_onegai", category: "挨拶" });
			const changes = diffEditableFields(before, after);
			assert.deepStrictEqual(changes, { name: "yorosiku_onegai", category: "挨拶" });
			assert.strictEqual(describeChangedFields(changes), "絵文字名、カテゴリ");
		});

		it("境界値：配列は中身で比べる", () => {
			const changes = diffEditableFields(baseFields({ aliases: ["a"] }), baseFields({ aliases: ["a"] }));
			assert.deepStrictEqual(changes, {});
		});
	});

	describe("buildEmojiRowFromRequest", () => {
		it("正常系：公開範囲は常に public で、webpublic の画像を公開用に使う", () => {
			const row = buildEmojiRowFromRequest(baseRequest(), file);
			assert.strictEqual(row.usageVisibility, "public");
			assert.strictEqual(row.publicUrl, "https://s3/w.webp");
			assert.strictEqual(row.originalUrl, "https://s3/o.png");
		});

		it("正常系：文字だけの絵文字はコピー可・CC0・作者なしに固定する", () => {
			const row = buildEmojiRowFromRequest(baseRequest({ isTextOnly: true, copyPermission: "deny", licenseName: "CC BY 4.0" }), file);
			assert.strictEqual(row.copyPermission, "a");
			assert.strictEqual(row.licenseName, "CC0 1.0 Universal");
			assert.strictEqual(row.creator, null);
		});

		it("正常系：許可の後、コピー可は使用情報の先頭に連絡先の文を付ける", () => {
			const row = buildEmojiRowFromRequest(baseRequest({ copyPermission: "conditional", askContact: "@emtk@mkkey.net" }), file);
			assert.strictEqual(row.copyPermission, "c");
			assert.strictEqual(row.usageInfo, "コピー前に次のユーザの許可を得る事 : @emtk@mkkey.net");
		});

		it("正常系：もこチキ＋一声のように使用情報もあれば 2 行でつなげる", () => {
			const row = buildEmojiRowFromRequest(
				baseRequest({ copyPermission: "conditional", askContact: "@emtk@mkkey.net", usageInfo: "コピー先でもライセンスを明記" }),
				file,
			);
			assert.strictEqual(row.usageInfo, "コピー前に次のユーザの許可を得る事 : @emtk@mkkey.net\nコピー先でもライセンスを明記");
		});

		it("正常系：自分がモチーフなら申請者をモチーフユーザーにする", () => {
			const row = buildEmojiRowFromRequest(baseRequest({ motifSelf: true, motifUserMode: "follow" }), file);
			assert.strictEqual(row.motifUserId, "user1");
			assert.strictEqual(row.motifUserMode, "follow");
		});

		it("正常系：モチーフでなければモチーフユーザーは無し", () => {
			const row = buildEmojiRowFromRequest(baseRequest({ motifSelf: false }), file);
			assert.strictEqual(row.motifUserId, null);
			assert.strictEqual(row.motifUserMode, "any");
		});
	});

	describe("appendHistory", () => {
		it("正常系：元の配列を変えずに 1 件足す", () => {
			const before = [{ at: "2026-01-01T00:00:00.000Z", by: "u", action: "created" as const }];
			const after = appendHistory(before, { by: "a", action: "approved" });
			assert.strictEqual(before.length, 1);
			assert.strictEqual(after.length, 2);
			assert.strictEqual(after[1].action, "approved");
		});
	});
});
