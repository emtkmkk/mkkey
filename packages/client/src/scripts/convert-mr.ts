export const dict = {
	"a": "01",
	"b": "1000",
	"c": "1010",
	"d": "100",
	"e": "0",
	"f": "0010",
	"g": "110",
	"h": "0000",
	"i": "00",
	"j": "0111",
	"k": "101",
	"l": "0100",
	"m": "11",
	"n": "10",
	"o": "111",
	"p": "0110",
	"q": "1101",
	"r": "010",
	"s": "000",
	"t": "1",
	"u": "001",
	"v": "0001",
	"w": "011",
	"x": "1001",
	"y": "1011",
	"z": "1100",
	"1": "01111",
	"2": "00111",
	"3": "00011",
	"4": "00001",
	"5": "00000",
	"6": "10000",
	"7": "11000",
	"8": "11100",
	"9": "11110",
	"0": "11111",
	".": "010101",
	",": "110011",
	":": "111000",
	"?": "001100",
	"!": "101011",
	"+": "01010",
	"-": "100001",
	"*": "1001",
	"/": "10010",
	"^": "111111",
	"=": "10001",
	"@": "011010",
	"(": "10110",
	")": "101101",
	"\"": "010010",
	"'": "011110",
	"[HH]": "00000000",
	"[VA]": "000101",
	"[AS]": "01000",
}

export const jpdict = {
	'イ': '01', 'ロ': '0101',
	'ハ': '1000', 'ニ': '1010',
	'ホ': '100', 'ヘ': '0',
	'ト': '00100', 'チ': '0010',
	'リ': '110', 'ヌ': '0000',
	'ル': '10110', 'ヲ': '0111',
	'ワ': '101', 'カ': '0100',
	'ヨ': '11', 'タ': '10',
	'レ': '111', 'ソ': '1110',
	'ツ': '0110', 'ネ': '1101',
	'ナ': '010', 'ラ': '000',
	'ム': '1', 'ウ': '001',
	'ヰ': '01001', 'ノ': '0011',
	'オ': '01000', 'ク': '0001',
	'ヤ': '011', 'マ': '1001',
	'ケ': '1011', 'フ': '1100',
	'コ': '1111', 'エ': '10111',
	'テ': '01011', 'ア': '11011',
	'サ': '10101', 'キ': '10100',
	'ユ': '10011', 'メ': '10001',
	'ミ': '00101', 'シ': '11010',
	'ヱ': '01100', 'ヒ': '11001',
	'モ': '10010', 'セ': '01110',
	'ス': '11101', 'ン': '01010',
	'゛': '00', '゜': '00110',
	'ー': '01101', '、': '010101',
	'」': '010100', '（': '101101',
	'）': '010010',
	"[ホレ]": "100111",
	"[ラタ]": "00010",
};

export function str_to_mr(str) {

	let _str = str.replace(/[ぁ-ん]/g, function (match) {
		var chr = match.charCodeAt(0) + 0x60;
		return String.fromCharCode(chr);
	}).toUpperCase();

	_str = _str.replaceAll("ガ", "カ゛").replaceAll("ギ", "キ゛").replaceAll("グ", "ク゛").replaceAll("ゲ", "ケ゛").replaceAll("ゴ", "コ゛");
	_str = _str.replaceAll("ザ", "サ゛").replaceAll("ジ", "シ゛").replaceAll("ズ", "ス゛").replaceAll("ゼ", "セ゛").replaceAll("ゾ", "ソ゛");
	_str = _str.replaceAll("ダ", "タ゛").replaceAll("ヂ", "チ゛").replaceAll("ヅ", "ツ゛").replaceAll("デ", "テ゛").replaceAll("ド", "ト゛");
	_str = _str.replaceAll("バ", "ハ゛").replaceAll("ビ", "ヒ゛").replaceAll("ブ", "フ゛").replaceAll("ベ", "ヘ゛").replaceAll("ボ", "ホ゛");
	_str = _str.replaceAll("パ", "ハ゜").replaceAll("ピ", "ヒ゜").replaceAll("プ", "フ゜").replaceAll("ペ", "ヘ゜").replaceAll("ポ", "ホ゜");
	_str = _str.replaceAll("ァ", "ア").replaceAll("ィ", "イ").replaceAll("ゥ", "ウ").replaceAll("ェ", "エ").replaceAll("ォ", "オ");
	_str = _str.replaceAll("ヵ", "カ").replaceAll("ッ", "ツ").replaceAll("ャ", "ヤ").replaceAll("ュ", "ユ").replaceAll("ョ", "ヨ");

	let jpmode = !/^[A-Z0-9.,:?!_+\-*^=\/@\(\)"']+$/.test(_str);
	let _jpmode = jpmode;

	let ret: Array<String> = [];

	let skipCnt = 0;

	if (jpmode) _str = _str.replaceAll(/(\n|\r)+/g, "」");

	let strarr = _str.split('')

	if (jpmode) {
		ret.push("100111");
	} else {
		ret.push("10001");
	}
	strarr.forEach((x) => {
		const jp = jpdict[x];
		if (jpmode && jp) {
			if (jpmode && !_jpmode) {
				if (!skipCnt) {
					ret.push("010010")
				} else {
					skipCnt -= 1
				}
				_jpmode = true;
			}
			ret.push(jp);
		} else {
			const en = dict[x.toLowerCase()];
			if (en && (!jpmode || x !== "\"")) {
				if (jpmode && _jpmode) {
					if (ret.length < 1 || ret[ret.length - 1] !== "101101") {
						ret.push("101101")
					} else {
						skipCnt += 1;
					}
					_jpmode = false;
				}
				ret.push(en);
			} else {
				ret.push(x);
			}
		}
	});

	if (jpmode) {
		if (jpmode && !_jpmode) {
			if (!skipCnt) {
				ret.push("010010")
			} else {
				skipCnt -= 1
			}
		}
		ret.push("00010");
	} else {
		ret.push("01010");
	}

	return ret.join(" ").replaceAll("0", "・").replaceAll("1", "－");

}

export function mr_to_str(mr, jpmode = true) {
	const mrarr = mr.replaceAll(/[-－]/g, "1").replaceAll(/[・・]/g, "0").split(/[\s ]+/);
	const rdict = {};
	const rjpdict = {};
	Object.keys(dict).forEach((x) => rdict[dict[x]] = x);
	Object.keys(jpdict).forEach((x) => rjpdict[jpdict[x]] = x);

	let _jpmode = jpmode;

	let ret: Array<String> = [];

	mrarr.forEach((x) => {
		if (!/^[01]+$/.test(x)) {
			ret.push(x);
			return;
		}
		if (jpmode && x === "010010") {
			_jpmode = true;
		}
		const jp = rjpdict[x];
		if (_jpmode && jp) {
			ret.push(jp);
			if (x === "101101") {
				_jpmode = false;
			}
		} else {
			const en = rdict[x];
			if (en) {
				ret.push(en);
			} else if (jp) {
				ret.push(jp);
			} else {
				ret.push("?");
			}
		}
	});

	let _ret = ret.join("");
	_ret = _ret.replaceAll("ガ", "カ゛").replaceAll("ギ", "キ゛").replaceAll("ク゛", "グ").replaceAll("ケ゛", "ゲ").replaceAll("コ゛", "ゴ");
	_ret = _ret.replaceAll("サ゛", "ザ").replaceAll("シ゛", "ジ").replaceAll("ス゛", "ズ").replaceAll("セ゛", "ゼ").replaceAll("ソ゛", "ゾ");
	_ret = _ret.replaceAll("タ゛", "ダ").replaceAll("チ゛", "ヂ").replaceAll("ツ゛", "ヅ").replaceAll("テ゛", "デ").replaceAll("ト゛", "ド");
	_ret = _ret.replaceAll("ハ゛", "バ").replaceAll("ヒ゛", "ビ").replaceAll("フ゛", "ブ").replaceAll("ヘ゛", "ベ").replaceAll("ホ゛", "ボ");
	_ret = _ret.replaceAll("ハ゜", "パ").replaceAll("ヒ゜", "ピ").replaceAll("フ゜", "プ").replaceAll("ヘ゜", "ペ").replaceAll("ホ゜", "ポ");
	return _ret.replaceAll("」", "\n");
}
