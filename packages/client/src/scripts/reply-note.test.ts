import assert from "node:assert/strict";
import test from "node:test";

import { noteWouldCopyExtraReplyMentions } from "./reply-note-mentions-core.ts";

const localHost = "example.com";
const identity = (value: string) => value;

const viewer = { username: "me", host: null as string | null };

function note(
	text: string | null,
	author: { username: string; host?: string | null },
) {
	return { text, user: author };
}

test("本文にメンションがない場合、false を返す", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note("こんにちは", { username: "bob" }),
			viewer,
			localHost,
			identity,
		),
		false,
	);
});

test("text が null の場合、false を返す", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note(null, { username: "bob" }),
			viewer,
			localHost,
			identity,
		),
		false,
	);
});

test("著者のみメンションの場合、false を返す", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note("@bob こんにちは", { username: "bob" }),
			viewer,
			localHost,
			identity,
		),
		false,
	);
});

test("著者以外のメンションがある場合、true を返す", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note("@bob @alice こんにちは", { username: "bob" }),
			viewer,
			localHost,
			identity,
		),
		true,
	);
});

test("自分へのメンションは除外して判定する", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note("@bob @me こんにちは", { username: "bob" }),
			viewer,
			localHost,
			identity,
		),
		false,
	);
});

test("自分以外へのメンションが残れば true を返す", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note("@bob @me @alice", { username: "bob" }),
			viewer,
			localHost,
			identity,
		),
		true,
	);
});

test("本人投稿への返信では著者メンションを前提にしない", () => {
	assert.equal(
		noteWouldCopyExtraReplyMentions(
			note("@alice @bob", { username: "me" }),
			viewer,
			localHost,
			identity,
		),
		true,
	);
});
