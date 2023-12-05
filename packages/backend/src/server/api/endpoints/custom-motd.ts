// import { IsNull } from 'typeorm';
import { fetchMeta } from "@/misc/fetch-meta.js";
import define from "../define.js";

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "string",
			optional: false,
			nullable: false,
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const meta = await fetchMeta();
	const motd = await Promise.all(meta.customMOTD.map((x) => x));
	
	const now = new Date();
	
	//季節メッセージ
	if (now.getMonth() === 0) {
		motd.push("冬ですね");
		if (now.getDate() == 1) {
			return [`HAPPY NEW YEAR ${now.getFullYear()} 🎉`,"あけましておめでとうございます！"];
		} else if (now.getDate() <= 3) {
			motd.push(`HAPPY NEW YEAR ${now.getFullYear()} 🎉`);
			motd.push("あけましておめでとうございます！")
		}
	} else if (now.getMonth() == 1) {
		motd.push("冬終盤ですね");
		if (now.getDate() == 3) {
			motd.push("鬼は外～");
			motd.push("福は内～");
		} else if (now.getDate() == 14) {
			motd.push("今日はバレンタインです");
		} else if (now.getDate() > 15) {
			motd.push("確定申告、終わりましたか？");
		}
	} else if (now.getMonth() == 2) {
		motd.push("春が始まりますね");
		if (now.getDate() == 3) {
			motd.push("明かりをつけましょぼんぼりに");
		} else if (now.getDate() == 14) {
			motd.push("今日はホワイトデーです");
		} else if (now.getDate() == 29) {
			motd.push("今日は閏日ですね");
		}
		if (now.getDate() <= 10) {
			motd.push("確定申告、終わりましたか？");
		}
		if (now.getDate() >= 18 && now.getDate() <= 22) {
			motd.push("大体このへんで昼と夜の長さが同じぐらいになるらしい");
		}
	} else if (now.getMonth() == 3) {
		motd.push("春ですね");
		if (now.getDate() == 1) {
			motd.push("今日は嘘つきのボーナスタイムらしいです");
		}
	} else if (now.getMonth() == 4) {
		motd.push("春ももうすぐ終わりですね");
		if (now.getDate() == 5) {
			motd.push("屋根より高い🎏");
		}
	} else if (now.getMonth() == 5) {
		motd.push("梅雨の季節ですね");
		if (now.getDate() == 6) {
			motd.push("UFOがあっちいってこっちいって落っこちる日");
		} else if (now.getDate() >= 19 && now.getDate() <= 23) {
			motd.push("大体このへんで昼が最も長いらしい");
		}
	} else if (now.getMonth() == 6) {
		motd.push("夏ですね");
		if (now.getDate() == 7) {
			motd.push("七夕ですね 今日は晴れてますか？");
		} else if (now.getDate() > 20) {
			motd.push("うなぎを食べる時期です");
		}
	} else if (now.getMonth() == 7) {
		motd.push("本格的に夏ですね");
		if (now.getDate() >= 11 && now.getDate() <= 15) {
			motd.push("阿波踊りの季節です");
		}
	} else if (now.getMonth() == 8) {
		motd.push("秋が始まりますね");
		if (now.getDate() == 15) {
			motd.push("今日は十五夜らしいです");
		} else if (now.getDate() >= 24 && now.getDate() <= 28) {
			motd.push("大体このへんで昼と夜の長さが同じぐらいになるらしい");
		}
	} else if (now.getMonth() == 9) {
			motd.push("秋ですね");
		if (now.getDate() == 31) {
			motd.push("Halloweeeeeeen");
		}
	} else if (now.getMonth() == 10) {
		motd.push("冬がやってきますね");
		if (now.getDate() == 26) {
			return [`今日は${meta.name} ${now.getFullYear() - 2022} 周年の日です！🎉`];
		}
	} else if (now.getMonth() == 11) {
		motd.push("冬が始まってきますね");
		if (now.getDate() == 31 && now.getHours() >= 18) {
			return [`${now.getFullYear()}年もお疲れ様でした。来年も頑張りましょう`];
		} else if (now.getDate() >= 19 && now.getDate() <= 23) {
			motd.push("大体このへんで夜が最も長いらしい");
			motd.push("お風呂にゆずを入れましょう");
		} else if (now.getDate() == 24 || now.getDate() == 25) {
			motd.push("クリスマスですね");
		}
		if (now.getDate() >= 30) {
			motd.push(`${now.getFullYear()}年がもうすぐ終わりますね`);
		}
		if (now.getDate() == 31) {
			motd.push("年越しそば、食べましたか？");
		}
	}
	
	if (user) {
		const eDay = Math.ceil((now.valueOf() - new Date(user.createdAt).valueOf()) / (1000 * 60 * 60 * 24));
		const avePost = Math.round((user.notesCount / eDay) * 10) / 10;
		const uName = user.name || user.username;
		
		if (new Date(user.birthday).getMonth() === now.getMonth() && new Date(user.birthday).getDate() === now.getDate()) {
			return ["誕生日おめでとうございます！🎉"];
		}
		
		if (now.getHours() >= 5 && now.getHours() <= 10) {
			motd.push(`おはようございます、${uName}さん`)
		} else if (now.getHours() >= 11 && now.getHours() <= 15) {
			motd.push(`こんにちは、${uName}さん`)
		} else if (now.getHours() >= 16 && now.getHours() <= 18) {
			if (now.getDay() >= 1 && now.getDay() <= 5){
				motd.push(`お疲れ様です、${uName}さん`)
			} else {
				motd.push(`こんにちは、${uName}さん`)
			}
		} else {
			motd.push(`こんばんは、${uName}さん`)
		}
		
		motd.push(`アカウントを作成してから ${eDay} 日目です`)
		motd.push(`あなたの現在の投稿数は ${user.notesCount} です`)
		if (eDay >= 7 && avePost >= 2) motd.push(`あなたの一日平均投稿数は ${avePost} です`)
		
		if (user.isCat && user.speakAsCat) motd.push("にゃー")
		if (user.isCat && user.speakAsCat) motd.push("にゃー！")
		if (user.isCat && user.speakAsCat) motd.push("にゃー……")
	}
	
	return motd;
});
