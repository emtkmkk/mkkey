import * as nodemailer from "nodemailer";
import { BATCH_EMAIL_SEND_INTERVAL } from "@/const.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import Logger from "./logger.js";
import config from "@/config/index.js";

export const logger = new Logger("email");

/**
 * メールを送信する。
 *
 * @param to - 宛先メールアドレス
 * @param subject - 件名
 * @param html - HTML 本文（共通の外枠テンプレートに埋め込まれる）
 * @param text - プレーンテキスト本文（そのまま送信される）
 * @param headers - 追加のメールヘッダ（List-Unsubscribe 等）
 */
export async function sendEmail(
	to: string,
	subject: string,
	html: string,
	text: string,
	headers?: Record<string, string>,
) {
	const meta = await fetchMeta(true);

	const iconUrl = `${config.url}/static-assets/mi-white.png`;
	const emailSettingUrl = `${config.url}/settings/email`;

	const enableAuth = meta.smtpUser != null && meta.smtpUser !== "";

	const transporter = nodemailer.createTransport({
		host: meta.smtpHost,
		port: meta.smtpPort,
		secure: meta.smtpSecure,
		ignoreTLS: !enableAuth,
		proxy: config.proxySmtp,
		auth: enableAuth
			? {
					user: meta.smtpUser,
					pass: meta.smtpPass,
			  }
			: undefined,
	} as any);

	try {
		const info = await transporter.sendMail({
			from: meta.email!,
			to: to,
			subject: subject,
			headers: headers,
			text: text,
			html: `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<title>${subject}</title>
	</head>
	<body style="background: #191724; padding: 16px; margin: 0; font-family: sans-serif; font-size: 14px;">
		<main style="max-width: 500px; margin: 0 auto; background: #1f1d2e; color: #e0def4; border-radius: 20px;">
			<header style="padding: 32px; background: #31748f; color: #e0def4; display: flex; border-radius: 20px;">
				<img src="${meta.logoImageUrl || meta.iconUrl || iconUrl}" style="max-width: 128px; max-height: 72px; vertical-align: bottom; margin-right: 16px;"/>
				<h1 style="margin: 0 0 1em 0;">${meta.name}</h1>
			</header>
			<article style="padding: 32px;">
				<h1 style="color: #ebbcba !important;">${subject}</h1>
				<div style="color: #e0def4;">${html}</div>
			</article>
			<footer style="padding: 32px; border-top: solid 1px #26233a;">
				<a href="${emailSettingUrl}" style="color: #9ccfd8 !important;">メール設定</a>
			</footer>
		</main>
		<nav style="box-sizing: border-box; max-width: 500px; margin: 16px auto 0 auto; padding: 0 32px;">
			<a href="${config.url}" style="color: #9ccfd8 !important;">${config.host}</a>
		</nav>
	</body>
</html>`,
		});

		logger.info(`Message sent: ${info.messageId}`);
	} catch (err) {
		logger.error(err as Error);
		throw err;
	}
}

// #region 案内メールの組み立て
/**
 * 案内メールの段落。
 *
 * - `string`: 通常の文章段落（HTML エスケープされる）
 * - `{ url, label? }`: リンク段落（html は `<a>`、text は URL そのまま）
 * - `{ html, text }`: 整形済み段落（呼び出し元でサニタイズ済みの HTML をそのまま埋め込む）
 *
 * @public
 */
export type GuidanceParagraph =
	| string
	| { url: string; label?: string }
	| { html: string; text: string };

/**
 * {@link buildGuidanceEmail} のオプション。
 *
 * @public
 */
export interface GuidanceEmailOptions {
	/** 件名の用件部分。「【サーバ名】{subjectBody}」となる */
	subjectBody: string;
	/** 宛名に使うユーザー名（@ なし）。指定時は先頭に「@username 様」が入る */
	recipientUsername?: string;
	/** 用件の段落（空行区切りで連結される）。文字列段落中の `{serverName}` はサーバ名に置換される */
	paragraphs: GuidanceParagraph[];
	/**
	 * 冒頭の挨拶。
	 *
	 * - `standard`: いつも{サーバ名}をご利用いただき、誠にありがとうございます。{サーバ名}運営です。
	 * - `plain`: {サーバ名}運営です。（「いつもご利用」が不自然な場面用）
	 * - `none`: 挨拶なし
	 *
	 * @defaultValue `"standard"`
	 */
	greeting?: "standard" | "plain" | "none";
	/**
	 * 結びの文。省略時は「今後とも{サーバ名}をよろしくお願いいたします。」、null で結びなし。
	 * 文中の `{serverName}` はサーバ名に置換される。
	 */
	closing?: string | null;
}

/**
 * HTML の特殊文字をエスケープする。
 *
 * @param str - エスケープする文字列
 * @returns エスケープ済み文字列
 * @internal
 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * 標準的な案内調のメール（件名 + html/text 本文）を組み立てる。
 *
 * @remarks
 * 本文構成は「宛名 → 挨拶 → 用件段落 → 結び」。
 * サーバ名は `meta.name`（未設定時は `config.host`）を使う。
 *
 * @param opts - 組み立てオプション
 * @returns sendEmail にそのまま渡せる subject / html / text
 * @public
 */
export async function buildGuidanceEmail(
	opts: GuidanceEmailOptions,
): Promise<{ subject: string; html: string; text: string }> {
	const meta = await fetchMeta(true);
	const serverName = meta.name || config.host;

	const blocks: { html: string; text: string }[] = [];
	const pushText = (line: string) => {
		const resolved = line.split("{serverName}").join(serverName);
		blocks.push({ html: escapeHtml(resolved), text: resolved });
	};

	if (opts.recipientUsername) {
		pushText(`@${opts.recipientUsername} 様`);
	}

	const greeting = opts.greeting ?? "standard";
	if (greeting === "standard") {
		pushText(
			`いつも${serverName}をご利用いただき、誠にありがとうございます。${serverName}運営です。`,
		);
	} else if (greeting === "plain") {
		pushText(`${serverName}運営です。`);
	}

	for (const paragraph of opts.paragraphs) {
		if (typeof paragraph === "string") {
			pushText(paragraph);
		} else if ("url" in paragraph) {
			blocks.push({
				html: `<a href="${escapeHtml(paragraph.url)}">${escapeHtml(
					paragraph.label ?? paragraph.url,
				)}</a>`,
				text: paragraph.url,
			});
		} else {
			blocks.push(paragraph);
		}
	}

	const closing =
		opts.closing === undefined
			? `今後とも${serverName}をよろしくお願いいたします。`
			: opts.closing;
	if (closing != null) {
		pushText(closing);
	}

	return {
		subject: `【${serverName}】${opts.subjectBody}`,
		html: blocks.map((block) => `<p>${block.html}</p>`).join(""),
		text: blocks.map((block) => block.text).join("\n\n"),
	};
}
// #endregion

// #region バッチ送信
/**
 * {@link runEmailBatch} の実行結果。
 *
 * @public
 */
export interface EmailBatchResult {
	/** 送信に成功した件数 */
	sent: number;
	/** 送信に失敗した件数 */
	failed: number;
	/** `shouldContinue` が false になり未処理のまま中断された件数 */
	remaining: number;
}

/**
 * 指定ミリ秒待つ。
 *
 * @internal
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * バッチ的なメール送信の共通処理。1通送るごとに待ち時間を空けて逐次送信する。
 *
 * @remarks
 * - バッチ処理（システムジョブ等）で複数の宛先へメールを送る場合は、
 *   SMTP・メールプロバイダへの負荷やスパム判定を避けるため必ずこの関数を使うこと。
 * - 待ち時間は次の送信の直前に挟む（最後の1通の後には待たない）。
 * - 各送信の直前に `shouldContinue` を評価し、false なら残りを送らず中断する
 *   （送信可能時間帯を外れた場合など。残件数は戻り値の `remaining` で返す）。
 * - `send` が throw しても続行し、`failed` に数えて `onError` に通知する。
 *
 * @param targets - 送信対象のリスト
 * @param send - 1件分の送信処理（成功時の DB 更新等も呼び出し元でここに書く）
 * @param options - 追加設定
 * @param options.intervalMs - 送信間隔（ms）。省略時は {@link BATCH_EMAIL_SEND_INTERVAL}（3分）
 * @param options.shouldContinue - 各送信の直前に評価し、false で残りを中断する
 * @param options.onError - 送信失敗時のフック（ログ用）
 * @returns 送信結果の集計
 * @public
 */
export async function runEmailBatch<T>(
	targets: T[],
	send: (target: T) => Promise<void>,
	options?: {
		intervalMs?: number;
		shouldContinue?: () => boolean;
		onError?: (target: T, err: unknown) => void;
	},
): Promise<EmailBatchResult> {
	const intervalMs = options?.intervalMs ?? BATCH_EMAIL_SEND_INTERVAL;

	let sent = 0;
	let failed = 0;

	for (let i = 0; i < targets.length; i++) {
		if (i > 0 && intervalMs > 0) {
			await sleep(intervalMs);
		}

		// 待ち時間の経過で時間帯を外れた場合もここで打ち切られる
		if (options?.shouldContinue && !options.shouldContinue()) {
			return { sent, failed, remaining: targets.length - i };
		}

		try {
			await send(targets[i]);
			sent++;
		} catch (err) {
			failed++;
			options?.onError?.(targets[i], err);
		}
	}

	return { sent, failed, remaining: 0 };
}
// #endregion
