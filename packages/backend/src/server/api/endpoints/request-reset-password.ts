import rndstr from "rndstr";
import { IsNull } from "typeorm";
import { publishMainStream } from "@/services/stream.js";
import config from "@/config/index.js";
import { Users, UserProfiles, PasswordResetRequests } from "@/models/index.js";
import { buildGuidanceEmail, sendEmail } from "@/services/send-email.js";
import { genId } from "@/misc/gen-id.js";
import { ApiError } from "../error.js";
import define from "../define.js";
import { HOUR } from "@/const.js";

export const meta = {
	tags: ["reset password"],

	requireCredential: false,

	description: "パスワードリセット用のメール送信を依頼します。",

	limit: {
		duration: HOUR,
		max: 3,
	},

	errors: {},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		username: { type: "string" },
		email: { type: "string" },
	},
	required: ["username", "email"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const user = await Users.findOneBy({
		usernameLower: ps.username.toLowerCase(),
		host: IsNull(),
	});

	// 合致するユーザーが登録されていなかったら無視
	if (user == null) {
		return;
	}

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	// 合致するメアドが登録されていなかったら無視
	if (profile.email !== ps.email) {
		return;
	}

	// メアドが認証されていなかったら無視
	if (!profile.emailVerified) {
		return;
	}

	const token = rndstr("a-z0-9", 64);

	await PasswordResetRequests.insert({
		id: genId(),
		createdAt: new Date(),
		userId: profile.userId,
		token,
	});

	const link = `${config.url}/reset-password/${token}`;

	const mail = await buildGuidanceEmail({
		subjectBody: "パスワード再設定のご案内",
		recipientUsername: user.username,
		paragraphs: [
			"パスワード再設定のご依頼を承りました。",
			"以下のリンクにアクセスしていただきますと、パスワードの再設定を行っていただけます。",
			{ url: link },
			"本メールにお心当たりのない場合は、お手数ですが本メールを破棄していただきますようお願いいたします。",
		],
	});
	sendEmail(ps.email, mail.subject, mail.html, mail.text);
});
