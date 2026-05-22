/**
 * @packageDocumentation
 *
 * 管理者/モデレーター向け: 特定メールアドレス専用・1回限りの招待コードを発行する API。
 *
 * @remarks
 * - `disableRegistration` と `emailRequiredForSignup` が両方ONのときのみ有効。
 * - 利用時は確認メールなしで即時登録し、成功時にチケットを削除する（1回限り・有効期限なし）。
 * - メール必須登録がOFFのときは本機能全体を無効とする。
 *
 * @internal
 */
import rndstr from "rndstr";
import { ApiError } from "../../error.js";
import define from "../../define.js";
import { RegistrationTickets, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { validateEmailForAccount } from "@/services/validate-email-for-account.js";
import { normalizeInvitationEmail } from "@/services/registration-ticket.js";
import { MoreThan } from "typeorm";
import { USER_HALFSLEEP_THRESHOLD } from "@/const.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			code: {
				type: "string",
				optional: false,
				nullable: false,
				example: "2ERUA5VR",
				maxLength: 8,
				minLength: 8,
			},
			allowedEmail: {
				type: "string",
				optional: false,
				nullable: false,
			},
		},
	},
	errors: {
		noActiveAdmin: {
			message:
				"1日以内にログインした管理人が存在しない為、現在招待コードを発行できません。",
			code: "NO_ACTIVE_ADMIN",
			id: "0d61e772-53b0-df53-de45-d294e76ab40b",
		},
		registrationNotRestricted: {
			message:
				"メール指定の招待コードは、新規登録を制限（招待制）しているときのみ発行できます。",
			code: "REGISTRATION_NOT_RESTRICTED",
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		},
		emailSignupNotEnabled: {
			message:
				"メール指定の招待コードは、アカウント登録にメールアドレスを必須にしているときのみ利用できます。",
			code: "EMAIL_SIGNUP_NOT_ENABLED",
			id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
		},
		invalidEmail: {
			message: "指定されたメールアドレスは登録に使用できません。",
			code: "INVALID_EMAIL",
			id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		emailAddress: { type: "string" },
	},
	required: ["emailAddress"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const instance = await fetchMeta(true);

	if (!instance.disableRegistration) {
		throw new ApiError(meta.errors.registrationNotRestricted);
	}

	if (!instance.emailRequiredForSignup) {
		throw new ApiError(meta.errors.emailSignupNotEnabled);
	}

	const admin = await Users.countBy({
		isAdmin: true,
		lastActiveDate: MoreThan(new Date(Date.now() - USER_HALFSLEEP_THRESHOLD)),
	});

	if (!admin) {
		throw new ApiError(meta.errors.noActiveAdmin);
	}

	const normalizedEmail = normalizeInvitationEmail(ps.emailAddress);
	const { available } = await validateEmailForAccount(normalizedEmail);

	if (!available) {
		throw new ApiError(meta.errors.invalidEmail);
	}

	const code = rndstr({
		length: 8,
		chars: "2-9A-HJ-NP-Z",
	});

	await RegistrationTickets.insert({
		id: genId(),
		createdAt: new Date(),
		code,
		inviteUserId: me.id,
		allowedEmail: normalizedEmail,
	});

	return {
		code,
		allowedEmail: normalizedEmail,
	};
});
