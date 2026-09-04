<template>
	<XModalWindow
		ref="dialog"
		:width="400"
		:height="600"
		:with-ok-button="true"
		:ok-button-disabled="false"
		:can-close="false"
		@close="dialog.close()"
		@closed="$emit('closed')"
		@ok="ok()"
		style="padding: 0.75rem"
	>
		<template #header>{{ title || i18n.ts.generateAccessToken }}</template>
		<div v-if="information" class="_section">
			<MkInfo warn>{{ information }}</MkInfo>
		</div>
		<div class="_section">
			<div style="margin-bottom: 1rem">
				<b>{{ i18n.ts.name }}</b>
			</div>
			<MkInput style="margin-bottom: 1rem" v-model="name" />
		</div>
		<div class="_section">
			<div style="margin-bottom: 1rem">
				<b>{{ i18n.ts.permission }}</b>
			</div>
			<MkButton inline @click="disableAll">{{
				i18n.ts.disableAll
			}}</MkButton>
			<MkButton
				style="margin-bottom: 0.75rem"
				inline
				@click="enableAll"
				>{{ i18n.ts.enableAll }}</MkButton
			>
			<MkSwitch
				style="margin-bottom: 0.375rem"
				v-for="kind in initialPermissions || availableKinds"
				:key="kind"
				v-model="permissions[kind]"
				>{{ i18n.t(`_permissions.${kind}`) }}</MkSwitch
			>
		</div>
	</XModalWindow>
</template>

<script lang="ts" setup>
import {} from "vue";
import { permissions as kinds } from "calckey-js";
import MkInput from "./form/input.vue";
import MkSwitch from "./form/switch.vue";
import MkButton from "./MkButton.vue";
import MkInfo from "./MkInfo.vue";
import XModalWindow from "@/components/MkModalWindow.vue";
import { i18n } from "@/i18n";
import { iAmModerator } from "@/account";

/**
 * 自分で選べるスコープ。
 *
 * 管理系（`read:admin:*` / `write:admin:*`）はエンドポイント側の
 * `requireModerator` / `requireAdmin` も通らないと使えないため、
 * 権限の無いユーザーに見せても選ぶ意味がない。一覧が長くなるだけなので隠す。
 *
 * なお `initialPermissions` が渡されている場合（アプリが要求しているスコープを
 * 確認する画面）は、要求内容をそのまま見せる必要があるのでこの絞り込みはしない。
 *
 * @remarks
 * 本家 Misskey も同じ絞り込みを行っているが、条件は `iAmAdmin` のみ。
 * mkkey が付与している管理系スコープはほとんどが `requireModerator` で、
 * モデレーターが実際に使えるため、こちらは `iAmModerator`（管理者を含む）で判定する。
 */
const availableKinds = iAmModerator
	? kinds
	: kinds.filter(
			(kind) => !kind.startsWith("read:admin") && !kind.startsWith("write:admin"),
	  );

const props = withDefaults(
	defineProps<{
		title?: string | null;
		information?: string | null;
		initialName?: string | null;
		initialPermissions?: string[] | null;
	}>(),
	{
		title: null,
		information: null,
		initialName: null,
		initialPermissions: null,
	}
);

const emit = defineEmits<{
	(ev: "closed"): void;
	(ev: "done", result: { name: string | null; permissions: string[] }): void;
}>();

const dialog = $ref<InstanceType<typeof XModalWindow>>();
let name = $ref(props.initialName);
let permissions = $ref({});

if (props.initialPermissions) {
	for (const kind of props.initialPermissions) {
		permissions[kind] = true;
	}
} else {
	for (const kind of availableKinds) {
		permissions[kind] = false;
	}
}

function ok(): void {
	emit("done", {
		name: name,
		permissions: Object.keys(permissions).filter((p) => permissions[p]),
	});
	dialog.close();
}

function disableAll(): void {
	for (const p in permissions) {
		permissions[p] = false;
	}
}

function enableAll(): void {
	for (const p in permissions) {
		permissions[p] = true;
	}
}
</script>
