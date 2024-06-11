import { db } from "@/db/postgre.js";
import { UserList } from "@/models/entities/user-list.js";
import { UserListJoinings, Users } from "../index.js";
import type { Packed } from "@/misc/schema.js";

export const UserListRepository = db.getRepository(UserList).extend({
	async pack(src: UserList["id"] | UserList): Promise<Packed<"UserList">> {

		if (typeof src === "object" ? src.id === "0000000000" : src === "0000000000" ) {
			const users = 
				await Users.createQueryBuilder("user")
				.andWhere("user.host IS NOT NULL")
				.orderBy("user.id", "ASC")
				.getMany();
			return {
				id: "0000000000",
				createdAt: new Date(0).toISOString(),
				name: "Local",
				userIds: users.map((x) => x.id),
			};
		}

		const userList =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		const users = await UserListJoinings.findBy({
			userListId: userList.id,
		});

		return {
			id: userList.id,
			createdAt: userList.createdAt.toISOString(),
			name: userList.name,
			userIds: users.map((x) => x.userId),
		};
	},
});
