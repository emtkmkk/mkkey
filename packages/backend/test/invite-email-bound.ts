/**
 * メール指定・1回限り招待コードの発行とサインアップ検証テスト。
 */
process.env.NODE_ENV = "test";

import * as assert from "assert";
import type * as childProcess from "child_process";
import { RegistrationTickets } from "@/models/index.js";
import {
	async as asyncHelper,
	api,
	request,
	shutdownServer,
	signup,
	startServer,
} from "./utils.js";

describe("メール指定招待コード", () => {
	let p: childProcess.ChildProcess;
	let admin: Awaited<ReturnType<typeof signup>>;
	let member: Awaited<ReturnType<typeof signup>>;

	const targetEmail = "invite-bound-test@example.com";
	const wrongEmail = "other-bound-test@example.com";

	before(async () => {
		p = await startServer();
		admin = await signup({ username: "invite_admin" });
		member = await signup({ username: "invite_member" });

		const metaRes = await api(
			"admin/update-meta",
			{
				disableRegistration: true,
				emailRequiredForSignup: true,
			},
			admin,
		);
		assert.strictEqual(metaRes.status, 200);
	});

	after(async () => {
		await shutdownServer(p);
	});

	it(
		"異常系：メール必須登録がOFFのとき、メール指定招待コードを発行できない",
		asyncHelper(async () => {
			await api(
				"admin/update-meta",
				{ emailRequiredForSignup: false },
				admin,
			);

			const res = await api(
				"admin/invite-email",
				{ emailAddress: targetEmail },
				admin,
			);
			assert.notStrictEqual(res.status, 200);

			await api(
				"admin/update-meta",
				{ emailRequiredForSignup: true },
				admin,
			);
		}),
	);

	it(
		"異常系：管理者/モデレーター以外はメール指定招待コードを発行できない",
		asyncHelper(async () => {
			const res = await api(
				"admin/invite-email",
				{ emailAddress: targetEmail },
				member,
			);
			assert.notStrictEqual(res.status, 200);
		}),
	);

	it(
		"正常系：管理者はメール指定招待コードを発行できる",
		asyncHelper(async () => {
			const res = await api(
				"admin/invite-email",
				{ emailAddress: targetEmail },
				admin,
			);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(typeof res.body?.code, "string");
			assert.strictEqual(res.body?.allowedEmail, targetEmail);
		}),
	);

	it(
		"異常系：指定メールと異なるメールではサインアップできない",
		asyncHelper(async () => {
			const issued = await api(
				"admin/invite-email",
				{ emailAddress: `unique-${Date.now()}@example.com` },
				admin,
			);
			assert.strictEqual(issued.status, 200);

			const res = await request("/signup", {
				username: `wrongmail${Date.now()}`,
				password: "testpass",
				emailAddress: wrongEmail,
				invitationCode: issued.body.code,
			});
			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body?.error?.code, "INVITATION_EMAIL_MISMATCH");

			const stillThere = await RegistrationTickets.findOneBy({
				code: issued.body.code,
			});
			assert.ok(stillThere);
		}),
	);

	it(
		"正常系：指定メールで即時サインアップするとコードが消費され再利用できない",
		asyncHelper(async () => {
			const email = `consume-${Date.now()}@example.com`;
			const issued = await api(
				"admin/invite-email",
				{ emailAddress: email },
				admin,
			);
			assert.strictEqual(issued.status, 200);
			const code = issued.body.code as string;

			const before = await RegistrationTickets.findOneBy({ code });
			assert.ok(before);

			const signupRes = await request("/signup", {
				username: `bounduser${Date.now()}`,
				password: "testpass",
				emailAddress: email,
				invitationCode: code,
			});
			assert.strictEqual(signupRes.status, 200);
			assert.ok(signupRes.body?.id);

			const after = await RegistrationTickets.findOneBy({ code });
			assert.strictEqual(after, null);

			const reuseRes = await request("/signup", {
				username: `bounduser2${Date.now()}`,
				password: "testpass",
				emailAddress: email,
				invitationCode: code,
			});
			assert.strictEqual(reuseRes.status, 400);
		}),
	);
});
