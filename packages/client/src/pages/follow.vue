<template>
	<div class="mk-follow-page"></div>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as os from "@/os";
import { mainRouter } from "@/router";
import { i18n } from "@/i18n";
import { resolveUserFromAcct } from "@/scripts/resolve-user-from-acct";
import {
	ackFollowReconfirmAfterFollow,
	clearFollowReconfirmFlags,
	confirmFollowReconfirmIfNeeded,
} from "@/scripts/follow-reconfirm";

async function follow(user): Promise<void> {
	const { canceled } = await os.confirm({
		type: "question",
		text: i18n.t("followConfirm", { name: user.name || user.username }),
	});

	if (canceled) {
		window.close();
		return;
	}

	const hadFollowReconfirm = user.needsFollowReconfirm === true;

	if (!(await confirmFollowReconfirmIfNeeded(user))) {
		window.close();
		return;
	}

	if (user.isSilenced) {
		const r = await os.confirm({
			type: "warning",
			text: i18n.t("silencedUserFollowConfirm"),
		});
		if (r.canceled) {
			window.close();
			return;
		}
	}

	if (user.isModerationWarning) {
		const r = await os.confirm({
			type: "warning",
			text: i18n.t("warnedUserFollowConfirm"),
			wait: 7,
		});
		if (r.canceled) {
			window.close();
			return;
		}
	}

	os.apiWithDialog("following/create", {
		userId: user.id,
	}).then(async () => {
		if (hadFollowReconfirm) {
			const acked = await ackFollowReconfirmAfterFollow(user.id);
			if (acked == null) {
				clearFollowReconfirmFlags(user);
			}
		}
	});
}

const acct = new URL(location.href).searchParams.get("acct");
if (acct == null) {
	throw new Error("acct required");
}

let promise;

if (acct.startsWith("https://")) {
	promise = os.api("ap/show", {
		uri: acct,
	});
	promise.then((res) => {
		if (res.type === "User") {
			follow(res.object);
		} else if (res.type === "Note") {
			mainRouter.push(`/notes/${res.object.id}`);
		} else {
			os.alert({
				type: "error",
				text: i18n.ts.notAUser,
			}).then(() => {
				window.close();
			});
		}
	});
} else {
	promise = resolveUserFromAcct(acct);
	promise.then((user) => {
		follow(user);
	});
}

os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);
</script>
