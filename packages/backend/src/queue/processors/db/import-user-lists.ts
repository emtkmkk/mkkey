import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import * as Acct from "@/misc/acct.js";
import { resolveUser } from "@/remote/resolve-user.js";
import { pushUserToUserList } from "@/services/user-list/push.js";
import { downloadTextFile } from "@/misc/download-text-file.js";
import { isSelfHost, toPuny } from "@/misc/convert-host.js";
import {
	DriveFiles,
	Users,
	UserLists,
	UserListJoinings,
} from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import type { DbUserImportJobData } from "@/queue/types.js";
import { In, IsNull } from "typeorm";
import type { UserList } from "@/models/entities/user-list.js";
import type { User } from "@/models/entities/user.js";

const logger = queueLogger.createSubLogger("import-user-lists");

/** 行データ: リスト名とユーザー指定 */
interface LineRow {
	linenum: number;
	listName: string;
	username: string;
	host: string | null;
}

/**
 * (usernameLower, host) をキーにする。host は null または puny 化済み。
 */
function userMapKey(username: string, host: string | null): string {
	const lower = username.toLowerCase();
	const h = host != null ? toPuny(host) : "";
	return `${lower}:${h}`;
}

export async function importUserLists(
	job: Bull.Job<DbUserImportJobData>,
	done: any,
): Promise<void> {
	logger.info(`Importing user lists of ${job.data.user.id} ...`);
	job.log("info - " + `Importing user lists of ${job.data.user.id} ...`);

	const user = await Users.findOneBy({ id: job.data.user.id });
	if (user == null) {
		done();
		return;
	}

	const file = await DriveFiles.findOneBy({
		id: job.data.fileId,
	});
	if (file == null) {
		done();
		return;
	}

	const csv = await downloadTextFile(file.url);
	const lines = csv.trim().split("\n");

	// 全行をパースし、一意なリスト名と (username, host) を収集
	const rows: LineRow[] = [];
	const uniqueListNames = new Set<string>();
	const localUsernameLowers = new Set<string>();
	const remoteByHost = new Map<string, Set<string>>();
	for (let i = 0; i < lines.length; i++) {
		try {
			const listName = lines[i].split(",")[0].trim();
			const { username, host } = Acct.parse(lines[i].split(",")[1].trim());
			const h = host ?? null;
			rows.push({ linenum: i + 1, listName, username, host: h });
			uniqueListNames.add(listName);
			const lower = username.toLowerCase();
			if (isSelfHost(h ?? undefined)) {
				localUsernameLowers.add(lower);
			} else if (h) {
				const puny = toPuny(h);
				const set = remoteByHost.get(puny) ?? new Set<string>();
				set.add(lower);
				remoteByHost.set(puny, set);
			}
		} catch (e) {
			logger.warn(`Error in line:${i + 1} ${e}`);
			job.log("warn - " + `Error in line:${i + 1} ${e}`);
		}
	}

	// リスト名一括取得
	const listNamesArray = [...uniqueListNames];
	const existingLists =
		listNamesArray.length > 0
			? await UserLists.findBy({
					userId: user.id,
					name: In(listNamesArray),
				})
			: [];
	const listByName = new Map<string, UserList>(
		existingLists.map((l) => [l.name, l]),
	);

	// ユーザー一括取得: ローカルとホスト別リモート
	const userByKey = new Map<string, User>();
	if (localUsernameLowers.size > 0) {
		const local = await Users.findBy({
			host: IsNull(),
			usernameLower: In([...localUsernameLowers]),
		});
		for (const u of local) {
			userByKey.set(userMapKey(u.username, null), u);
		}
	}
	for (const [host, usernames] of remoteByHost) {
		const remote = await Users.findBy({
			host,
			usernameLower: In([...usernames]),
		});
		for (const u of remote) {
			userByKey.set(userMapKey(u.username, u.host), u);
		}
	}

	// 行ループ: リストは map または新規作成、ユーザーは map または resolveUser
	for (const row of rows) {
		try {
			let list = listByName.get(row.listName);
			if (list == null) {
				const created: UserList = await UserLists.insert({
					id: genId(),
					createdAt: new Date(),
					userId: user.id,
					name: row.listName,
				}).then((x) => UserLists.findOneByOrFail(x.identifiers[0]));
				listByName.set(row.listName, created);
				list = created;
			}

			const key = userMapKey(row.username, row.host);
			let target = userByKey.get(key);
			if (target == null) {
				target = await resolveUser(row.username, row.host ?? undefined);
				if (target != null) {
					userByKey.set(key, target);
				}
			}

			if (target == null) continue;

			if (
				(await UserListJoinings.findOneBy({
					userListId: list.id,
					userId: target.id,
				})) != null
			)
				continue;

			pushUserToUserList(target, list);
		} catch (e) {
			logger.warn(`Error in line:${row.linenum} ${e}`);
			job.log("warn - " + `Error in line:${row.linenum} ${e}`);
		}
	}

	logger.succ("Imported");
	job.log("succ - " + "Imported");
	done();
}
