<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader :actions="headerActions" :tabs="headerTabs"
		/></template>
		<MkSpacer :content-max="800">
			<XPostForm
				v-if="state === 'writing'"
				fixed
				:instant="true"
				:initial-text="initialText"
				:initial-visibility="visibility"
				:initial-files="files"
				:initial-local-only="localOnly"
				:reply="reply"
				:renote="renote"
				:initial-visible-users="visibleUsers"
				class="_panel"
				@posted="state = 'posted'"
			/>
			<MkButton
				v-else-if="state === 'posted'"
				primary
				class="close"
				@click="goHome()"
				>{{ i18n.ts.home }}</MkButton
			>
			<MkButton
				v-if="state === 'posted'"
				class="close"
				@click="close()"
				>{{ i18n.ts.close }}</MkButton
			>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
// SPECIFICATION: https://misskey-hub.net/docs/features/share-form.html

import {} from "vue";
import { noteVisibilities } from "calckey-js";
import * as Acct from "calckey-js/built/acct";
import * as Misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import XPostForm from "@/components/MkPostForm.vue";
import * as os from "@/os";
import { mainRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";

const urlParams = new URLSearchParams(window.location.search);
const localOnlyQuery = urlParams.get("localOnly");
const visibilityQuery = urlParams.get("visibility");

let state = $ref("fetching" as "fetching" | "writing" | "posted");
let title = $ref(urlParams.get("title"));
const text = urlParams.get("text");
const url = urlParams.get("url");
let initialText = $ref(null as string | null);
let reply = $ref(null as Misskey.entities.Note | null);
let renote = $ref(null as Misskey.entities.Note | null);
let visibility = $ref(
	noteVisibilities.includes(visibilityQuery) ? visibilityQuery : null
);
let localOnly = $ref(
	localOnlyQuery === "0" ? false : localOnlyQuery === "1" ? true : null
);
let files = $ref([] as Misskey.entities.DriveFile[]);
let visibleUsers = $ref([] as Misskey.entities.User[]);

async function init() {
	let noteText = "";
	let rText = text ? text.trim() : null;
	let rUrl = url ? url.trim() : null;
	let textToUrl = text
		? text.match(
				/^(.* )?(https?:\/\/[\w/:%#\$&@\?\(\)~\.=\+\-ぁ-んァ-ヶｱ-ﾝﾞﾟ一-龠]+)+$/
		  )
		: null;

	if (title === "undefined") title = null;
	if (title) title = title.trim();

	if (!rUrl && textToUrl) {
		if (textToUrl.length == 2) {
			rUrl = textToUrl[1];
			rText = "";
		} else {
			if (textToUrl.length == 3) {
				rUrl = textToUrl[2];
				rText = textToUrl[1];
			} else {
				rText = textToUrl[0];
			}
		}
	}

	if (rUrl) {
		// 二重エンコード・三重エンコード検知
		if (rUrl !== decodeURI(rUrl)) rUrl = decodeURI(rUrl);
		if (rUrl !== decodeURI(rUrl)) rUrl = decodeURI(rUrl);

		if (rUrl !== encodeURI(rUrl)) {
			if (!title && !rText) rText = rUrl;
			rUrl = encodeURI(rUrl);
		}
	}

	// Yahooニュース
	if (rText && rText?.startsWith(`${title}.\n`)) {
		rText = rText.replace(`${title}.\n`, "");
	}

	// Twitter
	if (
		rText?.includes("https://twitter.com") ||
		rText?.includes("http://twitter.com")
	) {
		rText = rText.replaceAll(
			/(https?:\/\/twitter.com\/[^\s]*)(\?[^\s]*)/g,
			"$1"
		);
	}

	// Twitter
	if (
		rUrl?.includes("https://twitter.com") ||
		rUrl?.includes("http://twitter.com")
	) {
		rUrl = rUrl.replaceAll(
			/(https?:\/\/twitter.com\/[^\s]*)(\?[^\s]*)/g,
			"$1"
		);
	}

	if (rUrl) {
		if (title && rText)
			noteText += `< [${title
				.replaceAll("[", "【")
				.replaceAll("]", "】")}](${rUrl}) >\n${rText}\n\n`;
		else if (title)
			noteText += `[${title
				.replaceAll("[", "【")
				.replaceAll("]", "】")}](${rUrl})\n\n`;
		else if (rText)
			noteText += `[${rText
				.replaceAll("[", "【")
				.replaceAll("]", "】")}](${rUrl})\n\n`;
		else
			noteText +=
				rUrl.length > 31
					? `[${rUrl.slice(0, 30)}…](${rUrl})\n\n`
					: `${rUrl}\n\n`;
	} else {
		if (title && rText) noteText += `< ${title} >\n${rText}\n\n`;
		else if (title) noteText += `${title}\n\n`;
		else if (rText) noteText += `${rText}\n\n`;
	}

	initialText = noteText.trim();

	if (visibility === "specified") {
		const visibleUserIds = urlParams.get("visibleUserIds");
		const visibleAccts = urlParams.get("visibleAccts");
		await Promise.all(
			[
				...(visibleUserIds
					? visibleUserIds.split(",").map((userId) => ({ userId }))
					: []),
				...(visibleAccts
					? visibleAccts.split(",").map(Acct.parse)
					: []),
			]
				// TypeScriptの指示通りに変換する
				.map((q) =>
					"username" in q
						? {
								username: q.username,
								host: q.host === null ? undefined : q.host,
						  }
						: q
				)
				.map((q) =>
					os.api("users/show", q).then(
						(user) => {
							visibleUsers.push(user);
						},
						() => {
							console.error(
								`Invalid user query: ${JSON.stringify(q)}`
							);
						}
					)
				)
		);
	}

	try {
		//#region Reply
		const replyId = urlParams.get("replyId");
		const replyUri = urlParams.get("replyUri");
		if (replyId) {
			reply = await os.api("notes/show", {
				noteId: replyId,
			});
		} else if (replyUri) {
			const obj = await os.api("ap/show", {
				uri: replyUri,
			});
			if (obj.type === "Note") {
				reply = obj.object;
			}
		}
		//#endregion

		//#region Renote
		const renoteId = urlParams.get("renoteId");
		const renoteUri = urlParams.get("renoteUri");
		if (renoteId) {
			renote = await os.api("notes/show", {
				noteId: renoteId,
			});
		} else if (renoteUri) {
			const obj = await os.api("ap/show", {
				uri: renoteUri,
			});
			if (obj.type === "Note") {
				renote = obj.object;
			}
		}
		//#endregion

		//#region Drive files
		const fileIds = urlParams.get("fileIds");
		if (fileIds) {
			await Promise.all(
				fileIds.split(",").map((fileId) =>
					os.api("drive/files/show", { fileId }).then(
						(file) => {
							files.push(file);
						},
						() => {
							console.error(`Failed to fetch a file ${fileId}`);
						}
					)
				)
			);
		}
		//#endregion
	} catch (err) {
		os.alert({
			type: "error",
			title: err.message,
			text: err.name,
		});
	}

	state = "writing";
}

init();

function close(): void {
	window.close();

	// 閉じなければ100ms後タイムラインに
	/*window.setTimeout(() => {
		mainRouter.push("/");
	}, 100);*/
}

function goHome(): void {
	mainRouter.push("/");
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.share,
	icon: "ph-share-network ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.close {
	margin: 1rem auto;
}
</style>
