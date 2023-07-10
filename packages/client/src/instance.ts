import { computed, reactive } from "vue";
import { api } from "./os";
import type * as Misskey from "calckey-js";

// TODO: 他のタブと永続化されたstateを同期

const instanceData = localStorage.getItem("instance");
const remoteEmojiData = localStorage.getItem("remoteEmojiData") ?? "{}";

// TODO: instanceをリアクティブにするかは再考の余地あり

export const instance: Misskey.entities.InstanceMetadata = reactive(
	instanceData
		? {...JSON.parse(instanceData),...JSON.parse(remoteEmojiData)}
		: {
				// TODO: set default values
		  },
);

export async function fetchInstance() {
	const meta = await api("meta", {
		detail: false,
	});

	for (const [k, v] of Object.entries(meta)) {
			instance[k] = v;
	}

	localStorage.setItem("instance", JSON.stringify(instance));
}

export async function fetchPlusEmoji() {
	const meta = await api("meta", {
		detail: false,
		plusEmojis: true,
	});
	
	if (instance.remoteEmojiMode !== "all"){
		for (const [k, v] of Object.entries(meta)) {
				instance[k] = v;
		}
	}

	localStorage.setItem("remoteEmojiData", JSON.stringify(
		{
			emojiFetchDate: meta.emojiFetchDate,
			remoteEmojiMode: meta.remoteEmojiMode,
			remoteEmojiCount: meta.remoteEmojiCount,
			allEmojis: meta.allEmojis,
		})
	);
}

export async function fetchAllEmoji() {
	const meta = await api("meta", {
		detail: false,
		allEmojis: true,
	});

	for (const [k, v] of Object.entries(meta)) {
			instance[k] = v;
	}
	
	localStorage.setItem("remoteEmojiData", JSON.stringify(
		{
			emojiFetchDate: meta.emojiFetchDate,
			remoteEmojiMode: meta.remoteEmojiMode,
			remoteEmojiCount: meta.remoteEmojiCount,
			allEmojis: meta.allEmojis,
		})
	);
}

export const emojiCategories = computed(() => {
	if (instance.emojis == null) return [];
	const categories = new Set();
	for (const emoji of instance.emojis) {
		if (!emoji.category) continue;
		categories.add(emoji.category);
	}
	return Array.from(categories);
});

export const emojiTags = computed(() => {
	if (instance.emojis == null) return [];
	const tags = new Set();
	for (const emoji of instance.emojis) {
		for (const tag of emoji.aliases) {
			tags.add(tag);
		}
	}
	return Array.from(tags);
});

// このファイルに書きたくないけどここに書かないと何故かVeturが認識しない
declare module "@vue/runtime-core" {
	interface ComponentCustomProperties {
		$instance: typeof instance;
	}
}
