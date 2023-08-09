
const formatRoomajiCache = new Map();
const kanaHiraCache = new Map();

export function formatRoomaji(input) {
	if (!formatRoomajiCache.has(input)) {
		formatRoomajiCache.set(input, format_roomaji(input));
	}
	return formatRoomajiCache.get(input);
}

export function kanaToHira(input) {
	if (!kanaHiraCache.has(input)) {
		kanaHiraCache.set(input, kana_to_hira(input));
	}
	return kanaHiraCache.get(input);
}

export function jaToRoomaji(
	str: string
): string {
	
	let _str = str;
	
	// ひらがなかカタカナだけでなければ終了
	if (!/^[ぁ-んァ-ンー\s]+$/.test(_str)){
		return _str;	
	}
		
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

	replaceList.forEach((x) => _str = _str.replaceAll(x.before,x.after));

	return _str;

}

function format_roomaji(
	roomaji: string
): string {
	
	// 絵文字の突き合わせにのみ使うため同じ物として扱われれば
	// それで良いのでafterの方が正しいぞという意味ではないです
	
	// 変換前が2文字
	const replaceDataBefore2 = [
		{before:"ca", after:"ka"},
		{before:"ci", after:"ki"},
		{before:"cu", after:"ku"},
		{before:"ce", after:"ke"},
		{before:"co", after:"ko"},
		{before:"fu", after:"hu"},
		{before:"ja", after:"jya"},
		{before:"ju", after:"jyu"},
		{before:"je", after:"jye"},
		{before:"jo", after:"jyo"},
		{before:"fa", after:"fya"},
		{before:"fi", after:"fyi"},
		{before:"fe", after:"fye"},
		{before:"fu", after:"fyu"},
		{before:"fo", after:"fyo"},
		{before:"la", after:"xa"},
		{before:"li", after:"xi"},
		{before:"lu", after:"xu"},
		{before:"le", after:"xe"},
		{before:"lo", after:"xo"},
		{before:"va", after:"ba"},
		{before:"vi", after:"bi"},
		{before:"vu", after:"bu"},
		{before:"ve", after:"be"},
		{before:"vo", after:"bo"},
	]
	
	// 変換前が3文字
	const replaceDataBefore3 = [
		{before:"sha", after:"sya"},
		{before:"shi", after:"si"},
		{before:"shu", after:"syu"},
		{before:"sho", after:"syo"},
		{before:"syi", after:"si"},
		{before:"thi", after:"ti"},
		{before:"tsu", after:"tu"},
		{before:"kwa", after:"kya"},
		{before:"cya", after:"tya"},
		{before:"cyi", after:"tyi"},
		{before:"cyu", after:"tyu"},
		{before:"cye", after:"tye"},
		{before:"cyo", after:"tyo"},
		{before:"jya", after:"zya"},
		{before:"jyi", after:"zyi"},
		{before:"jyu", after:"zyu"},
		{before:"jye", after:"zye"},
		{before:"jyo", after:"zyo"},
		{before:"ltu", after:"xtu"},
	]
	
	let str = roomaji.toLowerCase()
	if (roomaji.length >= 3){
		replaceDataBefore3.forEach((x) => str = str.replaceAll(x.before,x.after));
	}
	if (roomaji.length >= 2){
		replaceDataBefore2.forEach((x) => str = str.replaceAll(x.before,x.after));
	}
	return str
}

function kana_to_hira(str) {
	return str.replace(/[ァ-ン]/g, function(match) {
		var chr = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(chr);
	});
}