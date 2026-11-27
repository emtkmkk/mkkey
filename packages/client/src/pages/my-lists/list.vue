<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader :actions="headerActions" :tabs="headerTabs"
		/></template>
		<MkSpacer :content-max="700">
			<div class="mk-list-page">
				<transition
					:name="$store.state.animation ? 'zoom' : ''"
					mode="out-in"
				>
					<div v-if="list" class="_section">
						<div class="_content">
							<MkButton inline @click="addUser()">{{
								i18n.ts.addUser
							}}</MkButton>
							<MkButton inline @click="renameList()">{{
								i18n.ts.rename
							}}</MkButton>
							<MkButton inline @click="deleteList()">{{
								i18n.ts.delete
							}}</MkButton>
						</div>
					</div>
				</transition>

				<transition
					:name="$store.state.animation ? 'zoom' : ''"
					mode="out-in"
				>
					<div v-if="list" class="_section members _gap">
						<div class="_title">{{ i18n.ts.members }}</div>
						<div class="_content">
							<div class="users">
								<div
									v-for="user in users"
									:key="user.id"
									class="user _panel"
								>
									<MkAvatar
										v-if="!user.unavailable"
										:user="user"
										class="avatar"
										:show-indicator="true"
									/>
									<div v-if="!user.unavailable" class="body">
										<MkUserName :user="user" class="name" />
										<MkAcct :user="user" class="acct" />
									</div>
									<div v-else class="body unavailable">
										<span class="name">{{ i18n.ts.unavailableMember }}</span>
										<span class="acct">{{ user.id }}</span>
									</div>
									<div class="action">
										<button
											class="_button"
											@click="removeUser(user)"
										>
											<i class="ph-x ph-bold ph-lg"></i>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</transition>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * リストのメンバー一覧と編集のページ。
 *
 * @remarks
 * - メンバーの情報は `users/show` で取る。削除済み・凍結中で取れなかったメンバーは
 *   「削除されたか、表示できないユーザー」として ID だけを出し、外せるようにする
 *   （{@link withUnavailableMembers}）。以前は画面に出ず、外す方法が無かった。
 *
 * @internal
 */
import { computed, watch } from "vue";
import MkButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { mainRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";
import { withUnavailableMembers } from "@/scripts/unavailable-members";

const props = defineProps<{
	listId: string;
}>();

let list = $ref(null);
let users = $ref([]);

function fetchList() {
	os.api("users/lists/show", {
		listId: props.listId,
	}).then((_list) => {
		list = _list;
		os.api("users/show", {
			userIds: list.userIds,
		}).then((_users) => {
			// 削除済み・凍結中で取れなかったメンバーも、外せるように行として残す
			users = withUnavailableMembers(list.userIds, _users);
		});
	});
}

function addUser() {
	os.selectUser().then((user) => {
		os.apiWithDialog("users/lists/push", {
			listId: list.id,
			userId: user.id,
		}).then(() => {
			users.push(user);
		});
	});
}

function removeUser(user) {
	os.api("users/lists/pull", {
		listId: list.id,
		userId: user.id,
	}).then(() => {
		users = users.filter((x) => x.id !== user.id);
	});
}

async function renameList() {
	const { canceled, result: name } = await os.inputText({
		title: i18n.ts.enterListName,
		default: list.name,
	});
	if (canceled) return;

	await os.api("users/lists/update", {
		listId: list.id,
		name: name,
	});

	list.name = name;
}

async function deleteList() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("removeAreYouSure", { x: list.name }),
	});
	if (canceled) return;

	await os.api("users/lists/delete", {
		listId: list.id,
	});
	os.success();
	mainRouter.push("/my/lists");
}

watch(() => props.listId, fetchList, { immediate: true });

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() =>
		list
			? {
					title: list.name,
					icon: "ph-list-bullets ph-bold ph-lg",
			  }
			: null
	)
);
</script>

<style lang="scss" scoped>
.mk-list-page {
	> .members {
		> ._content {
			> .users {
				> .user {
					display: flex;
					align-items: center;
					padding: 1rem;
					margin: 0.625rem 0 auto;

					> .avatar {
						width: 3.125rem;
						height: 3.125rem;
					}

					> .body {
						flex: 1;
						min-width: 0;
						padding: 0.5rem;

						> .name {
							display: block;
							font-weight: bold;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						> .acct {
							opacity: 0.5;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}
					}

					> .action {
						flex: 0 0 auto;
					}
				}
			}
		}
	}
}
</style>
