process.env.NODE_ENV = "test";

import * as assert from "assert";
import type * as childProcess from "child_process";
import { Repository } from "typeorm";
import { User } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import {
        async as asyncHelper,
        initTestDb,
        signup,
        startServer,
        shutdownServer,
} from "./utils.js";

describe("User relation", () => {
        let p: childProcess.ChildProcess;
        let userRepo: Repository<User>;

        before(async () => {
                p = await startServer();
                const connection = await initTestDb(true);
                userRepo = connection.getRepository(User);
        });

        after(async () => {
                await shutdownServer(p);
        });

        it(
                "target user hint keeps inviter flag",
                asyncHelper(async () => {
                        const inviter = await signup({ username: "inviter" });
                        const invitee = await signup({ username: "invitee" });
                        const other = await signup({ username: "other" });

                        await userRepo.update({ id: invitee.id }, { inviteUserId: inviter.id });

                        const inviteeEntity = await userRepo.findOneByOrFail({ id: invitee.id });
                        const otherEntity = await userRepo.findOneByOrFail({ id: other.id });

                        const relationWithHint = await Users.getRelation(
                                inviter.id,
                                invitee.id,
                                inviteeEntity,
                        );
                        const relationWithoutHint = await Users.getRelation(inviter.id, invitee.id);
                        const relationForOther = await Users.getRelation(
                                inviter.id,
                                other.id,
                                otherEntity,
                        );

                        assert.strictEqual(relationWithHint.isInviter, true);
                        assert.strictEqual(relationWithoutHint.isInviter, true);
                        assert.strictEqual(relationForOther.isInviter, false);
                }),
        );
});
