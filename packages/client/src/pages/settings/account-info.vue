<template>
	<div class="_formRoot">
		<MkKeyValue>
			<template #key>ID</template>
			<template #value
				><span class="_monospace">{{ $i.id }}</span></template
			>
		</MkKeyValue>

		<FormSection>
			<MkKeyValue>
				<template #key>{{ i18n.ts.registeredDate }}</template>
				<template #value
					><MkTime :time="$i.createdAt" mode="detail"
				/></template>
			</MkKeyValue>
		</FormSection>

		<FormSection v-if="stats">
			<template #label>{{ i18n.ts.statistics }}</template>
			<MkKeyValue oneline style="margin: 1em 0" :post="true" @postAction="post">
				<template #key>{{ i18n.ts.power }}</template>
				<template #value>{{ number(stats.power) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.powerRank }}</template>
				<template #value>{{ `${stats.powerRank ?? "N/A"} ( ${stats.nextRank ?? "N/A"} )` }}</template>
			</MkKeyValue>
			<MkKeyValue oneline v-if="stats.starPower" style="margin: 1em 0">
				<template #key>{{ "⭐" }}</template>
				<template #value>{{ number(stats.starPower ?? "N/A") }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.notesCount }}</template>
				<template #value>{{ number(stats.notesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.notesPostDays }}</template>
				<template #value>{{ number(stats.notesPostDays) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.averagePostCount }}</template>
				<template #value>{{ number(stats.averagePostCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.averageWordCount }}</template>
				<template #value>{{ number(stats.averageWordCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.repliesCount }}</template>
				<template #value>{{ number(stats.repliesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.renotesCount }}</template>
				<template #value>{{ number(stats.renotesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.quotesCount }}</template>
				<template #value>{{ number(stats.quotesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.repliedCount }}</template>
				<template #value>{{ number(stats.repliedCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.renotedCount }}</template>
				<template #value>{{ number(stats.renotedCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.sentReactionsCount }}</template>
				<template #value>{{
					number(stats.sentReactionsCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.receivedReactionsCount }}</template>
				<template #value>{{
					number(stats.receivedReactionsCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.averageSentReactionsCount }}</template>
				<template #value>{{
					number(stats.averageSentReactionsCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.averageReceivedReactionsCount }}</template>
				<template #value>{{
					number(stats.averageReceivedReactionsCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.pollVotesCount }}</template>
				<template #value>{{ number(stats.pollVotesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.pollVotedCount }}</template>
				<template #value>{{ number(stats.pollVotedCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.noteFavoritesCount }}</template>
				<template #value>{{
					number(stats.noteFavoritesCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.followingCount }}</template>
				<template #value>{{ number(stats.followingCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key
					>{{ i18n.ts.followingCount }} ({{
						i18n.ts.local
					}})</template
				>
				<template #value>{{
					number(stats.localFollowingCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key
					>{{ i18n.ts.followingCount }} ({{
						i18n.ts.remote
					}})</template
				>
				<template #value>{{
					number(stats.remoteFollowingCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.followersCount }}</template>
				<template #value>{{ number(stats.followersCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key
					>{{ i18n.ts.followersCount }} ({{
						i18n.ts.local
					}})</template
				>
				<template #value>{{
					number(stats.localFollowersCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key
					>{{ i18n.ts.followersCount }} ({{
						i18n.ts.remote
					}})</template
				>
				<template #value>{{
					number(stats.remoteFollowersCount)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.pageLikesCount }}</template>
				<template #value>{{ number(stats.pageLikesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.pageLikedCount }}</template>
				<template #value>{{ number(stats.pageLikedCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.driveFilesCount }}</template>
				<template #value>{{ number(stats.driveFilesCount) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.driveUsage }}</template>
				<template #value>{{ bytes(stats.driveUsage,2) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>{{ i18n.ts.ojPower }}</template>
				<template #value>{{ number(stats.ojPower) }}</template>
			</MkKeyValue>
			<MkKeyValue oneline v-if="stats.totalInviteCount" style="margin: 1em 0">
				<template #key>{{ i18n.ts.totalInviteCount }}</template>
				<template #value>{{ number(stats.totalInviteCount) }}</template>
			</MkKeyValue>
		</FormSection>

		<FormSection>
			<template #label>他サーバー絵文字</template>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>取得状態</template>
				<template #value>{{
					(instance.remoteEmojiMode === "all" ? "全て" : instance.remoteEmojiMode === "plus" ? "一部" : "無し") + (!instance.remoteEmojiMode || true ? "" : " (キャッシュ無し)")
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>取得数</template>
				<template #value>{{
					number(instance.remoteEmojiCount ?? 0)
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>サイズ</template>
				<template #value>{{
					bytes(JSON.stringify(instance)?.length,2) ?? "N/A"
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>最終取得</template>
				<template v-if="instance.emojiFetchDate" #value>
					<MkTime :time="instance.emojiFetchDate" mode="relative"/>
				</template>
				<template v-else #value>
					{{ "N/A" }}
				</template>
			</MkKeyValue>
			<FormButton @click="refetchEmoji"
				><i
					class="ph-arrows-counter-clockwise ph-bold ph-lg"
				></i>
					{{ i18n.ts.refetch }}</FormButton
			>
		</FormSection>

		<FormSection>
			<template #label>{{ i18n.ts.other }}</template>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>複数リアクション</template>
				<template #value>{{
					$i.patron ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>メール認証</template>
				<template #value>{{
					$i.emailVerified ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>二段階認証</template>
				<template #value>{{
					$i.twoFactorEnabled ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>物理キー</template>
				<template #value>{{
					$i.securityKeys ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>パスワードレス</template>
				<template #value>{{
					$i.usePasswordLessLogin ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>モデレーター</template>
				<template #value>{{
					$i.isModerator ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
			<MkKeyValue oneline style="margin: 1em 0">
				<template #key>管理者</template>
				<template #value>{{
					$i.isAdmin ? i18n.ts.yes : i18n.ts.no
				}}</template>
			</MkKeyValue>
		</FormSection>

		<FormLink to="/registry" class="_formBlock"
			><template #icon><i class="ph-gear-six ph-bold ph-lg"></i></template
			>{{ i18n.ts.registry }}</FormLink
		>

		<FormLink to="/errorlog" class="_formBlock"
			><template #icon><i class="ph-wrench ph-bold ph-lg"></i></template
			>{{ "errorlog" }}</FormLink
		>

		<FormLink v-if="$store.state.developer" to="/bios" class="_formBlock"
			><template #icon><i class="ph-wrench ph-bold ph-lg"></i></template
			>{{ i18n.ts.bios }}</FormLink
		>

	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import FormSection from "@/components/form/section.vue";
import FormLink from "@/components/form/link.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import FormButton from "@/components/MkButton.vue";
import * as os from "@/os";
import number from "@/filters/number";
import bytes from "@/filters/bytes";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { instance } from "@/instance";
import { unisonReload } from "@/scripts/unison-reload";
import { defaultStore } from "@/store";

const stats = ref<any>({});

let powerShowCount = 0;

onMounted(() => {
	os.api("users/stats", {
		userId: $i!.id,
	}).then((response) => {
		stats.value = response;
	});
});

const headerActions = $computed(() => [{
		icon: "ph-note-pencil ph-bold ph-lg",
		text: i18n.ts.postForm,
		iconOnly: true,
		handler: post,
	}]);

const headerTabs = $computed(() => []);

function post() {
	if (stats.value && stats.value.power && stats.value.powerRank) {
		powerShowCount += 1;
		if (powerShowCount % 2 === 0 || defaultStore.state.woozyMode) {
			os.post({
				initialText: `(´へεへ\`*)＜${stats.value.power > 100000000 ? `${Math.floor(stats.value.power / 10000000) / 10}億` : stats.value.power > 100000 ? `${Math.floor(stats.value.power / 10000)}万` : stats.value.power > 1000 ? `${Math.floor(stats.value.power / 1000) / 10}万` : stats.value.power}パワーなう\n\n(´へεへ\`*)＜${stats.value.powerRank.replace("⭐","$[rainbow.speed=2s ⭐]")}ランクなう\n\n☝( ◠‿◠ )☝「次のランクまでたったの${((1000 - (stats.value.rankPoint % 1000)) / 10).toFixed(1)}%か…ザコめ…」\n\n#もこきーパワー`,
				initialLocalOnly: true,
				instant: true,
			});
		} else {
			os.post({
				initialText: `<center>私のパワーは\n$[x2 $[tada ${number(stats.value.power)}]]\nです。\n\nランクは\n$[x2 $[tada ${stats.value.powerRank.replace("⭐","$[rainbow.speed=2s ⭐]")}]] ( ${stats.value.nextRank ?? "?%"} )\nです。\n\n#もこきーパワー</center>`,
				initialLocalOnly: true,
				instant: true,
			});
		}
	}
}

function refetchEmoji() {
	defaultStore.set("remoteEmojisFetch", "once");
	unisonReload();
}

definePageMetadata({
	title: i18n.ts.accountInfo,
	icon: "ph-info ph-bold ph-lg",
});
</script>
