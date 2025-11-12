import { Cache } from "./cache.js";
import type { User } from "@/models/entities/user.js";
import { UserGroupJoinings, UserListJoinings } from "@/models/index.js";

const listMembersCache = new Cache<User["id"][]>(1000 * 60 * 5);
const groupMembersCache = new Cache<User["id"][]>(1000 * 60 * 5);

export async function fetchListMembers(listId: string): Promise<User["id"][]> {
        return listMembersCache.fetch(listId, () =>
                UserListJoinings.findBy({
                        userListId: listId,
                }).then((res) => res.map((x) => x.userId)),
        );
}

export async function fetchGroupMembers(userGroupId: string): Promise<User["id"][]> {
        return groupMembersCache.fetch(userGroupId, () =>
                UserGroupJoinings.findBy({
                        userGroupId,
                }).then((res) => res.map((x) => x.userId)),
        );
}

export function invalidateListMembersCache(listId: string): void {
        listMembersCache.delete(listId);
}

export function invalidateGroupMembersCache(userGroupId: string): void {
        groupMembersCache.delete(userGroupId);
}
