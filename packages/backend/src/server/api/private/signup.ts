import type Koa from "koa";
import rndstr from "rndstr";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { verifyHcaptcha, verifyRecaptcha } from "@/misc/captcha.js";
import { Users, RegistrationTickets, UserPendings } from "@/models/index.js";
import { signup } from "../common/signup.js";
import config from "@/config/index.js";
import { sendEmail } from "@/services/send-email.js";
import { genId } from "@/misc/gen-id.js";
import { validateEmailForAccount } from "@/services/validate-email-for-account.js";
import { hashPassword } from "@/misc/password.js";

export default async (ctx: Koa.Context) => {
	const body = ctx.request.body;

	const instance = await fetchMeta(true);

	// Verify *Captcha
	// ただしテスト時はこの機構は障害となるため無効にする
	if (process.env.NODE_ENV !== "test") {
		if (instance.enableHcaptcha && instance.hcaptchaSecretKey) {
			await verifyHcaptcha(
				instance.hcaptchaSecretKey,
				body["hcaptcha-response"],
			).catch((e) => {
				ctx.throw(400, e);
			});
		}

		if (instance.enableRecaptcha && instance.recaptchaSecretKey) {
			await verifyRecaptcha(
				instance.recaptchaSecretKey,
				body["g-recaptcha-response"],
			).catch((e) => {
				ctx.throw(400, e);
			});
		}
	}

	const username = body["username"];
	const password = body["password"];
	const host: string | null =
		process.env.NODE_ENV === "test" ? body["host"] || null : null;
	const invitationCode = body["invitationCode"];
	const emailAddress = body["emailAddress"];
	let ticketUserId = undefined;

	if (config.reservedUsernames?.includes(username.toLowerCase())) {
		ctx.status = 400;
		return;
	}

	if (instance.emailRequiredForSignup) {
		if (emailAddress == null || typeof emailAddress !== "string") {
			ctx.status = 400;
			return;
		}

		const { available } = await validateEmailForAccount(emailAddress);
		if (!available) {
			ctx.status = 400;
			return;
		}
	}

	if (instance.disableRegistration) {
		if (invitationCode == null || typeof invitationCode !== "string") {
			ctx.status = 400;
			return;
		}

		const ticket = await RegistrationTickets.findOneBy({
			code: invitationCode,
		});

		if (ticket == null) {
			ctx.status = 400;
			return;
		}

		const now = new Date();

		// 発行から24時間以上経過している場合、無効
		if ((now.valueOf() - new Date(ticket.createdAt).valueOf()) > 24 * 60 * 60 * 1000) {
			RegistrationTickets.delete(ticket.id);
			ctx.status = 400;
			return;
		}
		
		ticketUserId = ticket.inviteUserId;

	}

	if (instance.emailRequiredForSignup) {
		const code = rndstr("a-z0-9", 16);

		// Generate hash of password
		const hash = await hashPassword(password);

		await UserPendings.insert({
			id: genId(),
			createdAt: new Date(),
			code,
			email: emailAddress,
			username: username,
			password: hash,
			inviteUserId: ticketUserId,
		});

		const link = `${config.url}/signup-complete/${code}`;

		sendEmail(
			emailAddress,
			"もこきー メールアドレス確認",
			`もこきーへの登録を完了するには、このリンクへアクセスしてください:<br><a href="${link}">${link}</a>`,
			`もこきーへの登録を完了するには、このリンクへアクセスしてください: ${link}`,
		);

		ctx.status = 204;
	} else {
		try {
			const { account, secret } = await signup({
				username,
				password,
				host,
				inviteUserId: ticketUserId,
			});

			const res = await Users.pack(account, account, {
				detail: true,
				includeSecrets: true,
			});

			(res as any).token = secret;

			ctx.body = res;
		} catch (e) {
			ctx.throw(400, e);
		}
	}
};
