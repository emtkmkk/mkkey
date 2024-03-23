export function isIncludeNgWordIsNote(note: any): string {
	if (!note.text ||  note.visibility !== "public") {
		return "";
	}

	return isIncludeNgWord([note.cw,note.text].filter(Boolean).join("_"));
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
		"けつ",
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
	];
	const ngword3 = ["地震", "津波", "震災", "震度", "震源"];
	const ngword4 = ["るぽ"]

	const text = txt
		.replaceAll(/\s/g, "")
		.replaceAll(/[!-\/:-@[-`{-~]+/g, "")
		.replace(/[ァ-ン]/g, function (match) {
			var chr = match.charCodeAt(0) - 0x60;
			return String.fromCharCode(chr);
		})
		.replaceAll("金", "きん")
		.replaceAll("玉", "たま")
		.replaceAll("ぱちんこ", "ぱチんこ");

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
*/
	if (ngword4.some((x) => {
		return text.includes(x);
	}) || /^([^\s:]{4,})\1+$/.test(text)) {
		return "NG";
	};
	return "";
}
