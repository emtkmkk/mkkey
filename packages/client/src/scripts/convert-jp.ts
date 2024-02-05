const formatRoomajiCache = new Map();
const kanaHiraCache = new Map();
const roomajiToJaCache = new Map();
const jaToRoomajiCache = new Map();

export function formatRoomaji(str: string): string {
	const _str = str.toLowerCase();
	if (!formatRoomajiCache.has(_str)) {
		formatRoomajiCache.set(_str, format_roomaji(_str));
	}
	return formatRoomajiCache.get(_str);
}

export function kanaToHira(str: string): string {
	if (!kanaHiraCache.has(str)) {
		kanaHiraCache.set(str, kana_to_hira(str));
	}
	return kanaHiraCache.get(str);
}

export function roomajiToJa(str: string): string {
	const _str = str.toLowerCase();
	if (!roomajiToJaCache.has(_str)) {
		roomajiToJaCache.set(_str, roomaji_to_ja(_str));
	}
	return roomajiToJaCache.get(_str);
}

export function jaToRoomaji(str: string): string {
	if (!jaToRoomajiCache.has(str)) {
		jaToRoomajiCache.set(str, ja_to_roomaji(str));
	}
	return jaToRoomajiCache.get(str);
}

export function roomaji_to_ja(str: string): string {
	let _str = str;

	// ひらがなかカタカナが含まれていれば終了
	if (/[ぁ-んァ-ンー\s]+/.test(_str)) {
		return _str;
	}

	let blobflg = false;

	if (_str.startsWith("blob")) {
		blobflg = true;
		_str = _str.replace("blob", "");
	}

	let ret = romaToHira(_str);

	return (blobflg ? "blob" : "") + ret;
}

export function ja_to_roomaji(str: string): string {
	let _str = str;

	// ひらがなかカタカナだけでなければ終了
	if (!/^[ぁ-んァ-ンー\s]+$/.test(_str)) {
		return _str;
	}

	_str = kanaToHira(_str);

	return hiraToRoma(_str);

	/*
	const replaceList = [
		{before:"きゃ", after:"kya"},
		{before:"きぃ", after:"kyi"},
		{before:"きゅ", after:"kyu"},
		{before:"きぇ", after:"kye"},
		{before:"きょ", after:"kyo"},
		{before:"しゃ", after:"sya"},
		{before:"しぃ", after:"syi"},
		{before:"しゅ", after:"syu"},
		{before:"しぇ", after:"sye"},
		{before:"しょ", after:"syo"},
		{before:"ちゃ", after:"cha"},
		{before:"ちぃ", after:"chi"},
		{before:"ちゅ", after:"chu"},
		{before:"ちぇ", after:"che"},
		{before:"ちょ", after:"cho"},
		{before:"にゃ", after:"nya"},
		{before:"にぃ", after:"nyi"},
		{before:"にゅ", after:"nyu"},
		{before:"にぇ", after:"nye"},
		{before:"にょ", after:"nyo"},
		{before:"ひゃ", after:"hya"},
		{before:"ひぃ", after:"hyi"},
		{before:"ひゅ", after:"hyu"},
		{before:"ひぇ", after:"hye"},
		{before:"ひょ", after:"hyo"},
		{before:"みゃ", after:"mya"},
		{before:"みぃ", after:"myi"},
		{before:"みゅ", after:"myu"},
		{before:"みぇ", after:"mye"},
		{before:"みょ", after:"myo"},
		{before:"ふぁ", after:"fa"},
		{before:"ふぃ", after:"fi"},
		{before:"ふぇ", after:"fu"},
		{before:"ふょ", after:"fo"},
		{before:"ぎゃ", after:"gya"},
		{before:"ぎぃ", after:"gyi"},
		{before:"ぎゅ", after:"gyu"},
		{before:"ぎぇ", after:"gye"},
		{before:"ぎょ", after:"gyo"},
		{before:"じゃ", after:"zya"},
		{before:"じぃ", after:"zyi"},
		{before:"じゅ", after:"zyu"},
		{before:"じぇ", after:"zye"},
		{before:"じょ", after:"zyo"},
		{before:"ぢゃ", after:"dya"},
		{before:"ぢぃ", after:"dyi"},
		{before:"ぢゅ", after:"dyu"},
		{before:"ぢぇ", after:"dye"},
		{before:"ぢょ", after:"dyo"},
		{before:"びゃ", after:"bya"},
		{before:"びぃ", after:"byi"},
		{before:"びゅ", after:"byu"},
		{before:"びぇ", after:"bye"},
		{before:"びょ", after:"byo"},
		{before:"ぴゃ", after:"pyo"},
		{before:"ぴぃ", after:"pyi"},
		{before:"ぴゅ", after:"pyu"},
		{before:"ぴぇ", after:"pye"},
		{before:"ぴょ", after:"pyo"},
		{before:"ぁ", after:"xa"},
		{before:"あ", after:"a"},
		{before:"ぃ", after:"xi"},
		{before:"い", after:"i"},
		{before:"ぅ", after:"xu"},
		{before:"う", after:"u"},
		{before:"ぇ", after:"xe"},
		{before:"え", after:"e"},
		{before:"ぉ", after:"xo"},
		{before:"お", after:"o"},
		{before:"か", after:"ka"},
		{before:"が", after:"ga"},
		{before:"き", after:"ki"},
		{before:"ぎ", after:"gi"},
		{before:"く", after:"ku"},
		{before:"ぐ", after:"gu"},
		{before:"け", after:"ke"},
		{before:"げ", after:"ge"},
		{before:"こ", after:"ko"},
		{before:"ご", after:"go"},
		{before:"さ", after:"sa"},
		{before:"ざ", after:"za"},
		{before:"し", after:"si"},
		{before:"じ", after:"zi"},
		{before:"す", after:"su"},
		{before:"ず", after:"zu"},
		{before:"せ", after:"se"},
		{before:"ぜ", after:"ze"},
		{before:"そ", after:"so"},
		{before:"ぞ", after:"zo"},
		{before:"た", after:"ta"},
		{before:"だ", after:"da"},
		{before:"ち", after:"ti"},
		{before:"ぢ", after:"di"},
		{before:"つ", after:"tu"},
		{before:"づ", after:"du"},
		{before:"て", after:"te"},
		{before:"で", after:"de"},
		{before:"と", after:"to"},
		{before:"ど", after:"do"},
		{before:"な", after:"na"},
		{before:"に", after:"ni"},
		{before:"ぬ", after:"nu"},
		{before:"ね", after:"ne"},
		{before:"の", after:"no"},
		{before:"は", after:"ha"},
		{before:"ば", after:"ba"},
		{before:"ぱ", after:"pa"},
		{before:"ひ", after:"hi"},
		{before:"び", after:"bi"},
		{before:"ぴ", after:"pi"},
		{before:"ふ", after:"fu"},
		{before:"ぶ", after:"bu"},
		{before:"ぷ", after:"pu"},
		{before:"へ", after:"he"},
		{before:"べ", after:"be"},
		{before:"ぺ", after:"pe"},
		{before:"ほ", after:"ho"},
		{before:"ぼ", after:"bo"},
		{before:"ぽ", after:"po"},
		{before:"ま", after:"ma"},
		{before:"み", after:"mi"},
		{before:"む", after:"mu"},
		{before:"め", after:"me"},
		{before:"も", after:"mo"},
		{before:"ゃ", after:"xya"},
		{before:"や", after:"ya"},
		{before:"ゅ", after:"xyu"},
		{before:"ゆ", after:"yu"},
		{before:"ょ", after:"xyo"},
		{before:"よ", after:"yo"},
		{before:"ら", after:"ra"},
		{before:"り", after:"ri"},
		{before:"る", after:"ru"},
		{before:"れ", after:"re"},
		{before:"ろ", after:"ro"},
		{before:"ゎ", after:"xwa"},
		{before:"わ", after:"wa"},
		{before:"ゐ", after:"i"},
		{before:"ゑ", after:"e"},
		{before:"を", after:"wo"},
		{before:"ん", after:"n"},
		{before:"ー", after:"_"},
		{before:/っ(\w)/g, after:"$1$1"},
		{before:"っ", after:"xtu"},
		{before:"！", after:"i"},
		{before:"?", after:"q"},
		{before:"？", after:"q"},
	];

	_str = kanaToHira(_str);

	replaceList.forEach((x) => _str = _str.replaceAll(x.before,x.after)); */
}

function format_roomaji(roomaji: string): string {
	// 絵文字の突き合わせにのみ使うため同じ物として扱われれば
	// それで良いのでafterの方が正しいぞという意味ではないです

	// 変換前が2文字
	const replaceDataBefore2 = [
		{ before: "ca", after: "ka" },
		{ before: "ci", after: "ki" },
		{ before: "cu", after: "ku" },
		{ before: "ce", after: "ke" },
		{ before: "co", after: "ko" },
		{ before: "fu", after: "hu" },
		{ before: "za", after: "jya" },
		{ before: "zi", after: "jyi" },
		{ before: "zu", after: "jyu" },
		{ before: "ze", after: "jye" },
		{ before: "zo", after: "jyo" },
		{ before: "ja", after: "jya" },
		{ before: "ju", after: "jyu" },
		{ before: "je", after: "jye" },
		{ before: "jo", after: "jyo" },
		{ before: "fa", after: "fya" },
		{ before: "fi", after: "fyi" },
		{ before: "fe", after: "fye" },
		{ before: "fu", after: "fyu" },
		{ before: "fo", after: "fyo" },
		{ before: "la", after: "xa" },
		{ before: "li", after: "xi" },
		{ before: "lu", after: "xu" },
		{ before: "le", after: "xe" },
		{ before: "lo", after: "xo" },
		{ before: "va", after: "ba" },
		{ before: "vi", after: "bi" },
		{ before: "vu", after: "bu" },
		{ before: "ve", after: "be" },
		{ before: "vo", after: "bo" },
		{ before: "_", after: "" },
	];

	// 変換前が3文字
	const replaceDataBefore3 = [
		{ before: "sha", after: "sya" },
		{ before: "shi", after: "si" },
		{ before: "shu", after: "syu" },
		{ before: "sho", after: "syo" },
		{ before: "syi", after: "si" },
		{ before: "chi", after: "ti" },
		{ before: "thi", after: "ti" },
		{ before: "tsu", after: "tu" },
		{ before: "kwa", after: "kya" },
		{ before: "cya", after: "tya" },
		{ before: "cyi", after: "tyi" },
		{ before: "cyu", after: "tyu" },
		{ before: "cye", after: "tye" },
		{ before: "cyo", after: "tyo" },
		{ before: "jya", after: "zya" },
		{ before: "jyi", after: "zyi" },
		{ before: "jyu", after: "zyu" },
		{ before: "jye", after: "zye" },
		{ before: "jyo", after: "zyo" },
		{ before: "ltu", after: "xtu" },
	];

	let str = roomaji.toLowerCase();
	if (roomaji.length >= 3) {
		replaceDataBefore3.forEach(
			(x) => (str = str.replaceAll(x.before, x.after)),
		);
	}
	if (roomaji.length >= 2) {
		replaceDataBefore2.forEach(
			(x) => (str = str.replaceAll(x.before, x.after)),
		);
	}
	return str;
}

function kana_to_hira(str) {
	return str.replace(/[ァ-ン]/g, function (match) {
		var chr = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(chr);
	});
}

export const tree = {
	"-": "ー",
	a: "あ",
	i: "い",
	u: "う",
	e: "え",
	o: "お",
	k: {
		a: "か",
		i: "き",
		u: "く",
		e: "け",
		o: "こ",
		y: {
			a: "きゃ",
			i: "きぃ",
			u: "きゅ",
			e: "きぇ",
			o: "きょ",
		},
		w: {
			a: "くぁ",
			i: "くぃ",
			u: "くぅ",
			e: "くぇ",
			o: "くぉ",
		},
	},
	s: {
		a: "さ",
		i: "し",
		u: "す",
		e: "せ",
		o: "そ",
		h: {
			a: "しゃ",
			i: "し",
			u: "しゅ",
			e: "しぇ",
			o: "しょ",
		},
		y: {
			a: "しゃ",
			i: "しぃ",
			u: "しゅ",
			e: "しぇ",
			o: "しょ",
		},
	},
	t: {
		a: "た",
		i: "ち",
		u: "つ",
		e: "て",
		o: "と",
		h: {
			a: "てゃ",
			i: "てぃ",
			u: "てゅ",
			e: "てぇ",
			o: "てょ",
		},
		y: {
			a: "ちゃ",
			i: "ちぃ",
			u: "ちゅ",
			e: "ちぇ",
			o: "ちょ",
		},
		s: {
			a: "つぁ",
			i: "つぃ",
			u: "つ",
			e: "つぇ",
			o: "つぉ",
		},
		w: {
			a: "とぁ",
			i: "とぃ",
			u: "とぅ",
			e: "とぇ",
			o: "とぉ",
		},
	},
	c: {
		a: "か",
		i: "し",
		u: "く",
		e: "せ",
		o: "こ",
		h: {
			a: "ちゃ",
			i: "ち",
			u: "ちゅ",
			e: "ちぇ",
			o: "ちょ",
		},
		y: {
			a: "ちゃ",
			i: "ちぃ",
			u: "ちゅ",
			e: "ちぇ",
			o: "ちょ",
		},
	},
	q: {
		a: "くぁ",
		i: "くぃ",
		u: "く",
		e: "くぇ",
		o: "くぉ",
	},
	n: {
		a: "な",
		i: "に",
		u: "ぬ",
		e: "ね",
		o: "の",
		//  n: "ん",
		y: {
			a: "にゃ",
			i: "にぃ",
			u: "にゅ",
			e: "にぇ",
			o: "にょ",
		},
	},
	h: {
		a: "は",
		i: "ひ",
		u: "ふ",
		e: "へ",
		o: "ほ",
		y: {
			a: "ひゃ",
			i: "ひぃ",
			u: "ひゅ",
			e: "ひぇ",
			o: "ひょ",
		},
		w: {
			a: "ふぁ",
			i: "ふぃ",
			e: "ふぇ",
			o: "ふぉ",
		},
	},
	f: {
		a: "ふぁ",
		i: "ふぃ",
		u: "ふ",
		e: "ふぇ",
		o: "ふぉ",
		y: {
			a: "ふゃ",
			u: "ふゅ",
			o: "ふょ",
		},
	},
	m: {
		a: "ま",
		i: "み",
		u: "む",
		e: "め",
		o: "も",
		y: {
			a: "みゃ",
			i: "みぃ",
			u: "みゅ",
			e: "みぇ",
			o: "みょ",
		},
	},
	y: {
		a: "や",
		i: "い",
		u: "ゆ",
		e: "いぇ",
		o: "よ",
	},
	r: {
		a: "ら",
		i: "り",
		u: "る",
		e: "れ",
		o: "ろ",
		y: {
			a: "りゃ",
			i: "りぃ",
			u: "りゅ",
			e: "りぇ",
			o: "りょ",
		},
	},
	w: {
		a: "わ",
		i: "うぃ",
		u: "う",
		e: "うぇ",
		o: "を",
		h: {
			a: "うぁ",
			i: "うぃ",
			u: "う",
			e: "うぇ",
			o: "うぉ",
		},
		y: {
			i: "ゐ",
			e: "ゑ",
		},
	},
	g: {
		a: "が",
		i: "ぎ",
		u: "ぐ",
		e: "げ",
		o: "ご",
		y: {
			a: "ぎゃ",
			i: "ぎぃ",
			u: "ぎゅ",
			e: "ぎぇ",
			o: "ぎょ",
		},
		w: {
			a: "ぐぁ",
			i: "ぐぃ",
			u: "ぐぅ",
			e: "ぐぇ",
			o: "ぐぉ",
		},
	},
	z: {
		a: "ざ",
		i: "じ",
		u: "ず",
		e: "ぜ",
		o: "ぞ",
		y: {
			a: "じゃ",
			i: "じぃ",
			u: "じゅ",
			e: "じぇ",
			o: "じょ",
		},
	},
	j: {
		a: "じゃ",
		i: "じ",
		u: "じゅ",
		e: "じぇ",
		o: "じょ",
		y: {
			a: "じゃ",
			i: "じぃ",
			u: "じゅ",
			e: "じぇ",
			o: "じょ",
		},
	},
	d: {
		a: "だ",
		i: "ぢ",
		u: "づ",
		e: "で",
		o: "ど",
		h: {
			a: "でゃ",
			i: "でぃ",
			u: "でゅ",
			e: "でぇ",
			o: "でょ",
		},
		y: {
			a: "ぢゃ",
			i: "ぢぃ",
			u: "ぢゅ",
			e: "ぢぇ",
			o: "ぢょ",
		},
		w: {
			a: "どぁ",
			i: "どぃ",
			u: "どぅ",
			e: "どぇ",
			o: "どぉ",
		},
	},
	b: {
		a: "ば",
		i: "び",
		u: "ぶ",
		e: "べ",
		o: "ぼ",
		y: {
			a: "びゃ",
			i: "びぃ",
			u: "びゅ",
			e: "びぇ",
			o: "びょ",
		},
	},
	v: {
		a: "ゔぁ",
		i: "ゔぃ",
		u: "ゔ",
		e: "ゔぇ",
		o: "ゔぉ",
		y: {
			a: "ゔゃ",
			i: "ゔぃ",
			u: "ゔゅ",
			e: "ゔぇ",
			o: "ゔょ",
		},
	},
	p: {
		a: "ぱ",
		i: "ぴ",
		u: "ぷ",
		e: "ぺ",
		o: "ぽ",
		y: {
			a: "ぴゃ",
			i: "ぴぃ",
			u: "ぴゅ",
			e: "ぴぇ",
			o: "ぴょ",
		},
	},
	x: {
		a: "ぁ",
		i: "ぃ",
		u: "ぅ",
		e: "ぇ",
		o: "ぉ",
		y: {
			a: "ゃ",
			i: "ぃ",
			u: "ゅ",
			e: "ぇ",
			o: "ょ",
		},
		t: {
			u: "っ",
			s: {
				u: "っ",
			},
		},
		w: {
			a: "ゎ",
		},
		k: {
			a: "ゕ", // 実際には "ヵ" になる
			e: "ゖ", // 実際には "ヶ" になる
		},
	},
	l: {
		a: "ぁ",
		i: "ぃ",
		u: "ぅ",
		e: "ぇ",
		o: "ぉ",
		y: {
			a: "ゃ",
			i: "ぃ",
			u: "ゅ",
			e: "ぇ",
			o: "ょ",
		},
		t: {
			u: "っ",
			s: {
				u: "っ",
			},
		},
		w: {
			a: "ゎ",
		},
		k: {
			a: "ゕ", // 実際には "ヵ" になる
			e: "ゖ", // 実際には "ヶ" になる
		},
	},
};

export function romaToHira(roma) {
	let result = "";
	let tmp = "";
	let index = 0;
	let node = tree;
	const len = roma.length;

	const push = (char, toRoot = true) => {
		result += char;
		tmp = "";
		node = toRoot ? tree : node;
	};

	while (index < len) {
		const char = roma.charAt(index);
		if (char.match(/[a-z-]/)) {
			if (char in node) {
				const next = node[char];
				if (typeof next === "string") {
					push(next);
				} else {
					tmp += roma.charAt(index);
					node = next;
				}
				index++;
				continue;
			}
			const prev = roma.charAt(index - 1);
			if (prev && (prev === "n" || prev === char)) {
				push(prev === "n" ? "ん" : "っ", false);
			}
			if (node !== tree && char in tree) {
				push(tmp);
				continue;
			}
		} else {
			const prev = roma.charAt(index - 1);
			if (prev === "n") push("ん");
		}
		push(tmp + char);
		index++;
	}
	tmp = tmp.replace(/n$/, "ん");
	push(tmp);
	return result
		.replaceAll("_", "")
		.replaceAll("んn", "ん")
		.replaceAll("nn", "ん")
		.replaceAll("n", "ん");
}

export const table = {
	いぇ: "ye",
	うぁ: "wha",
	うぃ: "wi",
	うぇ: "we",
	うぉ: "who",
	ゔぁ: "va",
	ゔぃ: "vi",
	ゔぇ: "ve",
	ゔぉ: "vo",
	ゔゃ: "vya",
	ゔゅ: "vyu",
	ゔょ: "vyo",
	きゃ: "kya",
	きぃ: "kyi",
	きゅ: "kyu",
	きぇ: "kye",
	きょ: "kyo",
	ぎゃ: "gya",
	ぎぃ: "gyi",
	ぎゅ: "gyu",
	ぎぇ: "gye",
	ぎょ: "gyo",
	くぁ: "kwa",
	くぃ: "kwi",
	くぅ: "kwu",
	くぇ: "kwe",
	くぉ: "kwo",
	ぐぁ: "gwa",
	ぐぃ: "gwi",
	ぐぅ: "gwu",
	ぐぇ: "gwe",
	ぐぉ: "gwo",
	しゃ: "sha",
	しぃ: "syi",
	しゅ: "shu",
	しぇ: "she",
	しょ: "sho",
	じゃ: "ja",
	じぃ: "jyi",
	じゅ: "ju",
	じぇ: "je",
	じょ: "jo",
	ちゃ: "cha",
	ちぃ: "cyi",
	ちゅ: "chu",
	ちぇ: "che",
	ちょ: "cho",
	ぢゃ: "dya",
	ぢぃ: "dyi",
	ぢゅ: "dyu",
	ぢぇ: "dye",
	ぢょ: "dyo",
	つぁ: "tsa",
	つぃ: "tsi",
	つぇ: "tse",
	つぉ: "tso",
	てゃ: "tha",
	てぃ: "thi",
	てゅ: "thu",
	てぇ: "the",
	てょ: "tho",
	でゃ: "dha",
	でぃ: "dhi",
	でゅ: "dhu",
	でぇ: "dhe",
	でょ: "dho",
	とぁ: "twa",
	とぃ: "twi",
	とぅ: "twu",
	とぇ: "twe",
	とぉ: "two",
	どぁ: "dwa",
	どぃ: "dwi",
	どぅ: "dwu",
	どぇ: "dwe",
	どぉ: "dwo",
	にゃ: "nya",
	にぃ: "nyi",
	にゅ: "nyu",
	にぇ: "nye",
	にょ: "nyo",
	ひゃ: "hya",
	ひぃ: "hyi",
	ひゅ: "hyu",
	ひぇ: "hye",
	ひょ: "hyo",
	ぴゃ: "pya",
	ぴぃ: "pyi",
	ぴゅ: "pyu",
	ぴぇ: "pye",
	ぴょ: "pyo",
	びゃ: "bya",
	びぃ: "byi",
	びぇ: "bye",
	びゅ: "byu",
	びょ: "byo",
	ふぁ: "fa",
	ふぃ: "fi",
	ふぇ: "fe",
	ふぉ: "fo",
	ふゃ: "fya",
	ふゅ: "fyu",
	ふょ: "fyo",
	みゃ: "mya",
	みぃ: "myi",
	みゅ: "myu",
	みぇ: "mye",
	みょ: "myo",
	りゃ: "rya",
	りぃ: "ryi",
	りゅ: "ryu",
	りぇ: "rye",
	りょ: "ryo",
	あ: "a",
	い: "i",
	う: "u",
	え: "e",
	お: "o",
	か: "ka",
	き: "ki",
	く: "ku",
	け: "ke",
	こ: "ko",
	さ: "sa",
	し: "si",
	す: "su",
	せ: "se",
	そ: "so",
	た: "ta",
	ち: "ti",
	つ: "tu",
	て: "te",
	と: "to",
	な: "na",
	に: "ni",
	ぬ: "nu",
	ね: "ne",
	の: "no",
	は: "ha",
	ひ: "hi",
	ふ: "fu",
	へ: "he",
	ほ: "ho",
	ま: "ma",
	み: "mi",
	む: "mu",
	め: "me",
	も: "mo",
	や: "ya",
	ゆ: "yu",
	よ: "yo",
	ら: "ra",
	り: "ri",
	る: "ru",
	れ: "re",
	ろ: "ro",
	わ: "wa",
	を: "wo",
	ん: "n",
	が: "ga",
	ぎ: "gi",
	ぐ: "gu",
	げ: "ge",
	ご: "go",
	ざ: "za",
	じ: "ji",
	ず: "zu",
	ぜ: "ze",
	ぞ: "zo",
	だ: "da",
	ぢ: "di",
	づ: "du",
	で: "de",
	ど: "do",
	ば: "ba",
	び: "bi",
	ぶ: "bu",
	べ: "be",
	ぼ: "bo",
	ぱ: "pa",
	ぴ: "pi",
	ぷ: "pu",
	ぺ: "pe",
	ぽ: "po",
	ぁ: "xa",
	ぃ: "xi",
	ぅ: "xu",
	ぇ: "xe",
	ぉ: "xo",
	ゃ: "xya",
	ゅ: "xyu",
	ょ: "xyo",
	ゎ: "xwa",
	ゕ: "xka", // 実際には "ヵ" になる
	ゖ: "xke", // 実際には "ヶ" になる
	ゔ: "vu",
	ゐ: "wyi",
	ゑ: "wye",
	ー: "_",
	"！": "i",
	"?": "q",
	"？": "q",
};

export function hiraToRoma(str) {
	const regTu = /っ([bcdfghjklmpqrstvwxyz])/gm;
	const regXtu = /っ/gm;

	const max = str.length;
	let index = 0;
	let roma = "";

	while (index < max) {
		let char = "";
		const twoChars = str.substring(index, index + 2);
		const oneChar = str.substring(index, index + 1);
		if (twoChars in table) {
			char = table[twoChars];
			index += 2;
		} else {
			char = table[oneChar] || oneChar;
			index += 1;
		}
		roma += char;
	}
	roma = roma.replace(regTu, "$1$1");
	roma = roma.replace(regXtu, "xtu");
	return roma;
}
