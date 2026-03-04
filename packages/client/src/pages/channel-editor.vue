<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader :actions="headerActions" :tabs="headerTabs"
		/></template>
		<MkSpacer :content-max="700">
			<div class="_formRoot">
				<MkInput v-model="name" class="_formBlock">
					<template #label>{{ i18n.ts.name }}</template>
				</MkInput>

				<MkTextarea v-model="description" class="_formBlock">
					<template #label>{{ i18n.ts.description }}</template>
				</MkTextarea>

				<div class="banner">
					<MkButton v-if="bannerId == null" @click="setBannerImage"
						><i class="ph-plus ph-bold ph-lg"></i>
						{{ i18n.ts._channel.setBanner }}</MkButton
					>
					<div v-else-if="bannerUrl">
						<img :src="bannerUrl" style="width: 100%" />
						<MkButton @click="removeBannerImage()"
							><i class="ph-trash ph-bold ph-lg"></i>
							{{ i18n.ts._channel.removeBanner }}</MkButton
						>
					</div>
				</div>

				<div v-if="$i?.isAdmin || $i?.isModerator" class="_formBlock">
					<MkInput :model-value="managerLabel" readonly>
						<template #label>{{ i18n.ts._channel.manager }}</template>
					</MkInput>
					<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem">
						<MkButton @click="selectManager()">{{ i18n.ts.selectUser }}</MkButton>
						<MkButton @click="clearManager()">{{ i18n.ts.none }}</MkButton>
					</div>
				</div>

				<div class="_formBlock">
					<MkButton primary @click="save()"
						><i class="ph-floppy-disk-back ph-bold ph-lg"></i>
						{{
							channelId ? i18n.ts.save : i18n.ts.create
						}}</MkButton
					>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch } from "vue";
import type * as misskey from "calckey-js";
import MkTextarea from "@/components/form/textarea.vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import { selectFile } from "@/scripts/select-file";
import * as os from "@/os";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";
import { $i } from "@/account";

const router = useRouter();

const props = defineProps<{
	channelId?: string;
}>();

let channel = $ref(null);
let name = $ref(null);
let description = $ref(null);
let bannerUrl = $ref<string | null>(null);
let bannerId = $ref<string | null>(null);
let managerUserId = $ref<string | null>(null);
let managerLabel = $ref(i18n.ts.none);

watch(
	() => bannerId,
	async () => {
		if (bannerId == null) {
			bannerUrl = null;
		} else {
			bannerUrl = (
				await os.api("drive/files/show", {
					fileId: bannerId,
				})
			).url;
		}
	}
);

function toUserLabel(user: misskey.entities.UserDetailed) {
	return `@${user.username}${user.host ? `@${user.host}` : ""}`;
}

async function fetchManagerLabel() {
	if (managerUserId == null) {
		managerLabel = i18n.ts.none;
		return;
	}

	const manager = await os.api("users/show", {
		userId: managerUserId,
	});

	managerLabel = toUserLabel(manager);
}

async function fetchChannel() {
	if (props.channelId == null) return;

	channel = await os.api("channels/show", {
		channelId: props.channelId,
	});

	name = channel.name;
	description = channel.description;
	bannerId = channel.bannerId;
	bannerUrl = channel.bannerUrl;
	managerUserId = channel.userId;
	await fetchManagerLabel();
}

fetchChannel();

function save() {
	const params = {
		name: name,
		description: description,
		bannerId: bannerId,
	};

	if (props.channelId) {
		params.channelId = props.channelId;
		if ($i?.isAdmin || $i?.isModerator) {
			params.userId = managerUserId;
		}
		os.api("channels/update", params).then(() => {
			os.success();
		});
	} else {
		os.api("channels/create", params).then((created) => {
			os.success();
			router.push(`/channels/${created.id}`);
		});
	}
}

function setBannerImage(evt) {
	selectFile(evt.currentTarget ?? evt.target, null).then((file) => {
		bannerId = file.id;
	});
}

function removeBannerImage() {
	bannerId = null;
}

async function selectManager() {
	const user = await os.selectUser({ includeSelf: true });
	managerUserId = user.id;
	managerLabel = toUserLabel(user);
}

function clearManager() {
	managerUserId = null;
	managerLabel = i18n.ts.none;
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() =>
		props.channelId
			? {
					title: i18n.ts._channel.edit,
					icon: "ph-television ph-bold ph-lg",
			  }
			: {
					title: i18n.ts._channel.create,
					icon: "ph-television ph-bold ph-lg",
			  }
	)
);
</script>

<style lang="scss" scoped></style>
