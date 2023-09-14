import { computed, reactive } from "vue";
import { api } from "./os";
import { stream } from '@/stream';
import type * as Misskey from "calckey-js";
import { get, set } from "./scripts/idb-proxy";


// TODO: 他のタブと永続化されたstateを同期

const instanceData = localStorage.getItem("instance");

// TODO: instanceをリアクティブにするかは再考の余地あり

export const instance: Misskey.entities.InstanceMetadata = reactive(
	instanceData
		? { ...JSON.parse(instanceData) }
		: {
			// TODO: set default values
		},
);

stream.on('emojiAdded', emojiData => {
	instance.emojis = [emojiData.emoji, ...instance.emojis];
});

stream.on('emojiUpdated', emojiData => {
	instance.emojis = instance.emojis.map(item => emojiData.emojis.find(search => search.id === item.id) as Misskey.entities.CustomEmoji ?? item);
});

stream.on('emojiDeleted', emojiData => {
	instance.emojis = instance.emojis.filter(item => !emojiData.emojis.some(search => search.id === item.id));
});

export async function emojiLoad() {
	if (!instance.remoteEmojiMode) {
		const remoteEmoji = await get("remoteEmojiData");
		
		if (remoteEmoji) {
			for (const [k, v] of Object.entries(remoteEmoji)) {
				instance[k] = v;
			}
		}
	}
}

export async function fetchInstance() {
	const meta = await api("meta", {
		detail: false,
		excludeEmoji: true,
	});

	for (const [k, v] of Object.entries(meta)) {
		instance[k] = v;
	}

	localStorage.setItem("instance", JSON.stringify(meta));
}

export async function fetchEmoji() {
	const meta = await api("emojis", {
		includeUrl: true,
	});

	await set("emojiData", meta);

	for (const [k, v] of Object.entries(meta)) {
		instance[k] = v;
	}
}

export async function fetchPlusEmoji() {
	const meta = await api("emojis", {
		remoteEmojis: "mini",
	});

	const remoteEmojiData = {
		emojiFetchDate: meta.emojiFetchDate,
		remoteEmojiMode: meta.remoteEmojiMode,
		remoteEmojiCount: meta.remoteEmojiCount,
		allEmojis: meta.allEmojis,
	};

	await set("remoteEmojiData", remoteEmojiData);

	for (const [k, v] of Object.entries(meta)) {
		instance[k] = v;
	}

}

export async function fetchAllEmoji() {
	const meta = await api("emojis", {
		remoteEmojis: "all",
	});

	const remoteEmojiData = {
		emojiFetchDate: meta.emojiFetchDate,
		remoteEmojiMode: meta.remoteEmojiMode,
		remoteEmojiCount: meta.remoteEmojiCount,
		allEmojis: meta.allEmojis,
	};

	await set("remoteEmojiData", remoteEmojiData);

	for (const [k, v] of Object.entries(meta)) {
		instance[k] = v;
	}

}

export async function fetchAllEmojiNoCache() {
	const meta = await api("emojis", {
		remoteEmojis: "all",
	});

	for (const [k, v] of Object.entries(meta)) {
		instance[k] = v;
	}
}

export async function fetchEmojiStats(limit) {
	const emojiStats = await api("emoji-stats", {
			limit,
			localOnly: true,
		});

		instance.recentlyPopularReactions = emojiStats.recentlySentReactions;
}

export const emojiCategories = computed(() => {
	if (instance.emojis == null) return [];
	const categories = new Set();
	for (const emoji of instance.emojis) {
		if (!emoji.category) continue;
		if (emoji.category.startsWith("!")) continue;
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
