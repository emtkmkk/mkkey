export function isIncludeNgWordIsNote(note: any): string {
	if (!note.text) {
		return "";
	}

	return isIncludeNgWord([note.cw, note.text].filter(Boolean).join("_"));
}

export function isIncludeNgWord(txt: string): string {
	const ngword1 = [
		"ちんちん",
		"ちんぽ",
		"ちんこ",
		"うんこ",
		"うんち",
		"おしっこ",
		"ぱいぱい",
		"きんたま",
		"おっぱい",
		"ぱいおつ",
		"乳首",
		"ちくび",
		"おむつ",
	];
	const ngword2 = [
		"おなほ",
		"ぱいずり",
		"射精",
		"しゃせい",
		"おなに",
		"精液",
		"せいえき",
		"まんこ",
		"ふたなり",
		"れいぷ",
		"せっくす",
		"せくーす",
		"ヴぁぎな",
		"しこっ",
		"性器",
		"処女",
		"受精",
		"自慰",
		"勃起",
		"fuck",
		"淫",
		"なかだし",
		"中出し",
		"せいし",
		"精子",
		"騎乗位",
		"孕",
	];
	const ngword3 = ["地震", "津波", "震災", "震度", "震源"];
	const ngword4 = ["るぽ"];

	const text = txt
		.toLowerCase()
		.replaceAll(/[\u0009-\u000d\u001c-\u0020\u11a3-\u11a7\u1680\u180e\u2000-\u200f\u202f\u205f\u2060\u3000\u3164\ufeff\u034f\u2028\u2029\u202a-\u202e\u2061-\u2063\ufeff]/g, "")
		.replaceAll(/[!-\/:-@[-`{-~]+/g, "")
		.replace(/[ァ-ン]/g, function (match) {
			var chr = match.charCodeAt(0) - 0x60;
			return String.fromCharCode(chr);
		})
		.replaceAll("金", "きん")
		.replaceAll("玉", "たま")
		.replaceAll("ぱちんこ", "ぱチんこ")
		.replaceAll("ゆにせっくす", "ゆにセっくす");

	if (
		ngword2.some((x) => {
			return text.includes(x);
		})
	) {
		return "シモ";
	}

	if (
		ngword1.some((x) => {
			return text.includes(x);
		})
	) {
		return "シモ(弱)";
	}
	/*
	if (note.text.includes("3.11")) return "暗いニュース";

	if (ngword3.some((x) => {
		return text.includes(x);
	})) {
		return "暗いニュース";
	};
	if (
		ngword4.some((x) => {
			return text.includes(x);
		}) ||
		/^([^\s:]{4,})\1+$/.test(text)
	) {
		return "NG";
	}
 */
	return "";
}
