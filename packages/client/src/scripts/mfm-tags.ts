export const MFM_TAGS = [
	"tada",
	"jelly",
	"twitch",
	"shake",
	"spin",
	"jump",
	"bounce",
	"flip",
	"x2",
	"x3",
	"x4",
	"scale",
	"position",
	"fg",
	"bg",
	"font",
	"blur",
	"rainbow",
	"sparkle",
	"rotate",
];
export const MFM_TAGS_JP = [
	{name:"x2", ja:"サイズ2倍", exportLeft:"$[x2 ", exportRight:"]",},
	{name:"x3", ja:"サイズ3倍", exportLeft:"$[x3 ", exportRight:"]",},
	{name:"x4", ja:"サイズ4倍", exportLeft:"$[x4 ", exportRight:"]",},
	{name:"center", ja:"中央揃え", exportLeft:"<center>", exportRight:"</center>",},
	{name:"bold", ja:"太字", exportLeft:"**", exportRight:"**",},
	{name:"italic", ja:"斜体", exportLeft:"<i>", exportRight:"</i>",},
	{name:"strike", ja:"取り消し線", exportLeft:"~~", exportRight:"~~",},
	{name:"small", ja:"控えめ", exportLeft:"<small>", exportRight:"</small>",},
	{name:"quote", ja:"引用", exportLeft:"> ", exportRight:"",},
	{name:"plain", ja:"そのまま表示", exportLeft:"<plain>", exportRight:"</plain>",},
	{name:"search", ja:"検索欄", exportLeft:"", exportRight:" [Search]",},
	{name:"rainbow", ja:"ゲーミング", exportLeft:"$[rainbow ", exportRight:"]", defaultOption:"$[rainbow.speed=2s ",},
	{name:"sparkle", ja:"キラキラ", exportLeft:"$[sparkle ", exportRight:"]",},
	{name:"tada", ja:"じゃーん", exportLeft:"$[tada ", exportRight:"]", defaultOption:"$[tada.speed=1s ",},
	{name:"jelly", ja:"びよーん", exportLeft:"$[jelly ", exportRight:"]", defaultOption:"$[jelly.speed=1s ",},
	{name:"shake", ja:"振動（小）", exportLeft:"$[shake ", exportRight:"]", defaultOption:"$[shake.speed=0.5s ",},
	{name:"twitch", ja:"振動（大）", exportLeft:"$[twitch ", exportRight:"]", defaultOption:"$[twitch.speed=0.5s ",},
	{name:"jump", ja:"ジャンプ", exportLeft:"$[jump ", exportRight:"]", defaultOption:"$[jump.speed=0.75s ",},
	{name:"bounce", ja:"バウンド", exportLeft:"$[bounce ", exportRight:"]", defaultOption:"$[bounce.speed=0.75s ",},
	{name:"spinR", ja:"右回転", exportLeft:"$[spin ", exportRight:"]", defaultOption:"$[spin.speed=1.5s ",},
	{name:"spinL", ja:"左回転", exportLeft:"$[spin.left ", exportRight:"]", defaultOption:"$[spin.left,speed=1.5s ",},
	{name:"spinA", ja:"往復回転", exportLeft:"$[spin.alternate ", exportRight:"]", defaultOption:"$[spin.alternate,speed=1.5s ",},
	{name:"spinX", ja:"X回転", exportLeft:"$[spin.x ", exportRight:"]", defaultOption:"$[spin.x,speed=1.5s ",},
	{name:"spinY", ja:"Y回転", exportLeft:"$[spin.y ", exportRight:"]", defaultOption:"$[spin.y,speed=1.5s ",},
	{name:"flipH", ja:"横反転", exportLeft:"$[flip ", exportRight:"]",},
	{name:"flipV", ja:"縦反転", exportLeft:"$[flip.v ", exportRight:"]",},
	{name:"flipHV", ja:"縦横反転", exportLeft:"$[flip.h,v ", exportRight:"]",},
	{name:"blur", ja:"ぼかし", exportLeft:"$[blur ", exportRight:"]",},
	{name:"fade", ja:"フェードイン", exportLeft:"$[fade ", exportRight:"]", defaultOption:"$[fade.speed=1.5s ",},
	{name:"fade", ja:"フェードアウト", exportLeft:"$[fade.out ", exportRight:"]", defaultOption:"$[fade.out,speed=1.5s ",},
	{name:"ruby", ja:"ルビ振り", exportLeft:"$[ruby ", exportRight:"]",},
	{name:"unixtime", ja:"時間", exportLeft:`$[unixtime ${Math.floor(Date.now() / 1000)}`, exportRight:"]",},
	{name:"code", ja:"行コード", exportLeft:"`", exportRight:"`",},
	{name:"codeB", ja:"ブロックコード", exportLeft:"```\n", exportRight:"\n```",},
	{name:"KaTeX", ja:"行数式", exportLeft:"\\(", exportRight:"\\)",},
	{name:"KaTeXB", ja:"ブロック数式", exportLeft:"\\[", exportRight:"\\]",},
	{name:"fg", ja:"文字色変更", exportLeft:"$[fg ", exportRight:"]", defaultOption:"$[fg.color=FF0000 ",},
	{name:"bg", ja:"背景色変更", exportLeft:"$[bg ", exportRight:"]", defaultOption:"$[bg.color=FF0000 ",},
	{name:"scale", ja:"サイズ調整", exportLeft:"$[scale ", exportRight:"]", defaultOption:"$[scale.x=1,y=1 ",},
	{name:"position", ja:"位置調整", exportLeft:"$[position ", exportRight:"]", defaultOption:"$[position.x=0,y=0 ",},
	{name:"rotateZ", ja:"回転調整", exportLeft:"$[rotate ", exportRight:"]", defaultOption:"$[rotate.deg=90 ",},
	{name:"rotateX", ja:"X回転調整", exportLeft:"$[rotate.x ", exportRight:"]", defaultOption:"$[rotate.x,deg=45 ",},
	{name:"rotateY", ja:"Y回転調整", exportLeft:"$[rotate.y ", exportRight:"]", defaultOption:"$[rotate.y,deg=45 ",},
	{name:"crop", ja:"キリトリ", exportLeft:"$[crop ", exportRight:"]", defaultOption:"$[crop.top=0,left=0,bottom=0,right=0 ",},
	{name:"serif", ja:"セリフﾌｫﾝﾄ", exportLeft:"$[font.serif ", exportRight:"]",},
	{name:"mono", ja:"等幅ﾌｫﾝﾄ", exportLeft:"$[font.monospace ", exportRight:"]",},
	{name:"cursive", ja:"筆記体ﾌｫﾝﾄ", exportLeft:"$[font.cursive ", exportRight:"]",},
	{name:"fantasy", ja:"ファンタジー", exportLeft:"$[font.fantasy ", exportRight:"]",},
	{name:"emoji", ja:"絵文字ﾌｫﾝﾄ", exportLeft:"$[font.emoji ", exportRight:"]",},
	{name:"math", ja:"計算式ﾌｫﾝﾄ", exportLeft:"$[font.math ", exportRight:"]",},
];
