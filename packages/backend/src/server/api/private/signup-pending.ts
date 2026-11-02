import type Koa from "koa";
import { Users, UserPendings, UserProfiles } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { signup } from "../common/signup.js";
import signin from "../common/signin.js";

export default async (ctx: Koa.Context) => {
	// koa の型では body が unknown のため、フォーム値として扱えるようにする
	const body = ctx.request.body as Record<string, string>;

	const code = body["code"];

	try {
		const pendingUser = await UserPendings.findOneByOrFail({ code });

		const { account, secret } = await signup({
			username: pendingUser.username,
			passwordHash: pendingUser.password,
			inviteUserId: pendingUser.inviteUserId,
		});

		UserPendings.delete({
			id: pendingUser.id,
		});

		const profile = await UserProfiles.findOneByOrFail({ userId: account.id });

		await UserProfiles.update(
			{ userId: profile.userId },
			{
				email: pendingUser.email,
				emailVerified: true,
				emailVerifyCode: null,
			},
		);

		// signup はローカルユーザー（host: null）を作るので ILocalUser として扱う
		signin(ctx, account as ILocalUser);
	} catch (e) {
		// catch の変数は unknown。ctx.throw には従来どおりそのまま渡す（Error 以外でも挙動は変えない）
		ctx.throw(400, e as Error);
	}
};
