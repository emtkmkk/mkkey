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
	if (now.getMonth() == 10 && now.getDate() == 26) {
		return ["今日はもこきー " + (now.getFullYear() - 2022) + " 周年の日です！🎉"];
	}
	
	if (user) {
		const eDay = Math.ceil((now.valueOf() - new Date(user.createdAt).valueOf()) / (1000 * 60 * 60 * 24));
		const avePost = Math.round((user.notesCount / eDay) * 10) / 10;
		const uName = user.name || user.username;
		
		if (new Date(user.birthday).getMonth() === now.getMonth() && new Date(user.birthday).getDate() === now.getDate()) {
			return ["誕生日おめでとうございます！🎉"];
		}
		
		if (now.getHours() >= 5 && now.getHours() <= 10) {
			motd.push("おはようございます、" + uName + "さん")
		} else if (now.getHours() >= 11 && now.getHours() <= 15) {
			motd.push("こんにちは、" + uName + "さん")
		} else if (now.getHours() >= 16 && now.getHours() <= 18) {
			if (now.getDay() >= 1 && now.getDay() <= 5){
				motd.push("お疲れ様です、" + uName + "さん")
			} else {
				motd.push("こんにちは、" + uName + "さん")
			}
		} else {
			motd.push("こんばんは、" + uName + "さん")
		}
		
		motd.push("アカウントを作成してから " + eDay + " 日目です")
		motd.push("あなたの現在のノート数は " + user.notesCount + " です")
		if (eDay >= 7 && avePost >= 2) motd.push("あなたの一日平均ノート数は " + avePost + " です")
		
		if (user.isCat && user.speakAsCat) motd.push("にゃー")
		if (user.isCat && user.speakAsCat) motd.push("にゃー！")
		if (user.isCat && user.speakAsCat) motd.push("にゃー……")
	}
	
	return motd;
});
