export function isIncludeNgWord(note: any): string {

	if ((note.cw?.trim() && note.cw?.trim() !== "CW") || !note.text || note.visibility != "public") {
		return "";
	}

	const ngword1 = ["ちんちん", "ちんぽ", "ちんこ", "うんこ", "うんち", "おしっこ", "ぱいぱい", "きんたま"]
	const ngword2 = ["おなほ", "おっぱい", "ぱいおつ", "ぱいずり", "乳首", "ちくび", "射精", "しゃせい", "おなに", "精液", "せいえき", "まんこ", "ふたなり", "れいぷ", "せっくす", "せくーす", "ヴぁぎな", "しこっ", "性器", "処女", "受精", "自慰", "勃起"];

	const text = note.text
		.replaceAll(/\s/g, "")
		.replaceAll(/[!-\/:-@[-`{-~]+/g, "")
		.replace(/[ァ-ン]/g, function (match) {
			var chr = match.charCodeAt(0) - 0x60;
			return String.fromCharCode(chr);
		})
		.replaceAll("金","きん")
		.replaceAll("玉","たま")
		.replaceAll("ぱちんこ", "ぱチんこ")

	if (ngword2.some((x) => {
		return text.includes(x);
	})) {
		return "シモ";
	};

	if (ngword1.some((x) => {
		return text.includes(x);
	})) {
		return "シモ(弱)";
	}

	return "";
}
