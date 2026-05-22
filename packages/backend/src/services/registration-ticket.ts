/**
 * @packageDocumentation
 *
 * 登録招待チケットの検証・メール正規化・期限判定を行うヘルパー。
 *
 * @remarks
 * - 通常招待とメール指定招待の分岐をここに集約し、サインアップ処理の重複を避ける。
 *
 * @see {@link RegistrationTicket} エンティティ
 * @internal
 */
import type { RegistrationTicket } from "@/models/entities/registration-tickets.js";

/** 招待コードの有効期限（ミリ秒） */
export const REGISTRATION_TICKET_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 招待チケット用にメールアドレスを正規化する
 *
 * @param email - 生のメールアドレス
 * @returns trim + 小文字化した文字列
 * @internal
 */
export function normalizeInvitationEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * メール指定招待チケットかどうか
 *
 * @param ticket - 招待チケット
 * @returns `allowedEmail` が設定されていれば true
 * @internal
 */
export function isEmailBoundRegistrationTicket(
	ticket: RegistrationTicket,
): boolean {
	return ticket.allowedEmail != null && ticket.allowedEmail !== "";
}

/**
 * 招待チケットが期限切れかどうか
 *
 * @param ticket - 招待チケット
 * @returns 通常招待は発行から24時間超で true。メール指定招待は期限なし（常に false）
 * @internal
 */
export function isRegistrationTicketExpired(
	ticket: RegistrationTicket,
): boolean {
	// メール指定招待は有効期限を設けない
	if (isEmailBoundRegistrationTicket(ticket)) {
		return false;
	}

	const now = new Date();
	return (
		now.valueOf() - new Date(ticket.createdAt).valueOf() >
		REGISTRATION_TICKET_TTL_MS
	);
}

/**
 * メール指定チケットと入力メールが一致するか
 *
 * @param ticket - 招待チケット
 * @param emailAddress - サインアップ時に入力されたメール
 * @returns 通常招待は常に true。メール指定は正規化後の一致のみ true
 * @internal
 */
export function emailMatchesRegistrationTicket(
	ticket: RegistrationTicket,
	emailAddress: string,
): boolean {
	if (!isEmailBoundRegistrationTicket(ticket)) {
		return true;
	}
	return (
		normalizeInvitationEmail(emailAddress) === ticket.allowedEmail
	);
}
