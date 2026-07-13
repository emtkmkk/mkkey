/**
 * @packageDocumentation
 *
 * サインアップ API（招待コード検証・メール確認待ち作成・即時登録）。
 *
 * @remarks
 * - メール指定招待: メール必須登録ON時のみ有効。有効期限なし・確認メールなしで即時登録。
 * - 通常招待: 従来どおり（24時間・メール必須時は確認メールフロー）。
 *
 * @internal
 */
import type Koa from "koa";
import rndstr from "rndstr";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { verifyHcaptcha, verifyRecaptcha } from "@/misc/captcha.js";
import { Users, RegistrationTickets, UserPendings, UserProfiles } from "@/models/index.js";
import { signup } from "../common/signup.js";
import config from "@/config/index.js";
import { buildGuidanceEmail, sendEmail } from "@/services/send-email.js";
import { genId } from "@/misc/gen-id.js";
import { validateEmailForAccount } from "@/services/validate-email-for-account.js";
import { hashPassword } from "@/misc/password.js";
import type { RegistrationTicket } from "@/models/entities/registration-tickets.js";
import {
	emailMatchesRegistrationTicket,
	isEmailBoundRegistrationTicket,
	isRegistrationTicketExpired,
	normalizeInvitationEmail,
} from "@/services/registration-ticket.js";

/** サインアップ API のエラーコード: 招待コード向けメールと入力が不一致 */
export const SIGNUP_ERROR_INVITATION_EMAIL_MISMATCH = {
	message:
		"この招待コードは、発行時に指定されたメールアドレスでのみ利用できます。別のメールアドレスでは登録できません。",
	code: "INVITATION_EMAIL_MISMATCH",
	id: "d4e5f6a7-b8c9-0123-def4-567890abcdef",
} as const;

/**
 * サインアップ API 用のエラーレスポンスを返す
 *
 * @param ctx - Koa コンテキスト
 * @param error - code / message / id を含むエラー定義
 * @internal
 */
function respondSignupError(
	ctx: Koa.Context,
	error: { message: string; code: string; id: string },
): void {
	ctx.status = 400;
	ctx.body = { error };
}

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
	let ticketUserId: string | undefined = undefined;
	let emailBoundTicket: RegistrationTicket | null = null;

	if (config.reservedUsernames?.includes(username.toLowerCase())) {
		ctx.status = 400;
		return;
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

		// 通常招待のみ24時間で失効（メール指定招待は期限なし）
		if (isRegistrationTicketExpired(ticket)) {
			await RegistrationTickets.delete(ticket.id);
			ctx.status = 400;
			return;
		}

		if (isEmailBoundRegistrationTicket(ticket)) {
			// メール必須登録がOFFのときはメール指定招待を無効化
			if (!instance.emailRequiredForSignup) {
				ctx.status = 400;
				return;
			}
			if (emailAddress == null || typeof emailAddress !== "string") {
				ctx.status = 400;
				return;
			}
			if (!emailMatchesRegistrationTicket(ticket, emailAddress)) {
				respondSignupError(ctx, SIGNUP_ERROR_INVITATION_EMAIL_MISMATCH);
				return;
			}
			emailBoundTicket = ticket;
		}

		ticketUserId = ticket.inviteUserId;
	}

	// メール指定招待: 確認メールを送らず即時登録
	if (emailBoundTicket != null) {
		const normalizedEmail = normalizeInvitationEmail(emailAddress);

		const { available } = await validateEmailForAccount(normalizedEmail);
		if (!available) {
			ctx.status = 400;
			return;
		}

		try {
			const { account, secret } = await signup({
				username,
				password,
				host,
				inviteUserId: ticketUserId,
			});

			await UserProfiles.update(
				{ userId: account.id },
				{
					email: normalizedEmail,
					emailVerified: true,
					emailVerifyCode: null,
				},
			);

			// 登録成功時にチケットを削除（1回限り）
			await RegistrationTickets.delete(emailBoundTicket.id);

			const res = await Users.pack(account, account, {
				detail: true,
				includeSecrets: true,
			});

			(res as any).token = secret;

			ctx.body = res;
		} catch (e) {
			ctx.throw(400, e);
		}
		return;
	}

	if (instance.emailRequiredForSignup) {
		if (emailAddress == null || typeof emailAddress !== "string") {
			ctx.status = 400;
			return;
		}

		const { available } = await validateEmailForAccount(
			normalizeInvitationEmail(emailAddress),
		);
		if (!available) {
			ctx.status = 400;
			return;
		}
	}

	if (instance.emailRequiredForSignup) {
		const code = rndstr("a-z0-9", 16);

		// Generate hash of password
		const hash = await hashPassword(password);

		await UserPendings.insert({
			id: genId(),
			createdAt: new Date(),
			code,
			email: normalizeInvitationEmail(emailAddress),
			username: username,
			password: hash,
			inviteUserId: ticketUserId,
		});

		const link = `${config.url}/signup-complete/${code}`;

		const mail = await buildGuidanceEmail({
			subjectBody: "メールアドレス確認のご案内",
			recipientUsername: username,
			greeting: "plain",
			paragraphs: [
				"このたびは{serverName}にご登録いただき、誠にありがとうございます。",
				"以下のリンクにアクセスしていただきますと、ご登録が完了いたします。",
				{ url: link },
				"本メールにお心当たりのない場合は、お手数ですが本メールを破棄していただきますようお願いいたします。",
			],
		});
		sendEmail(emailAddress, mail.subject, mail.html, mail.text);

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
