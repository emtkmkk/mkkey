export interface FollowingExistsCondition {
        clause(column: string): string;
        parameters: Record<string, unknown>;
}

export function createFollowingExistsCondition(
        followerId: string,
        options?: { parameterName?: string; alias?: string },
): FollowingExistsCondition {
        const parameterName = options?.parameterName ?? "followingFollowerId";
        const alias = options?.alias ?? "following_exists";

        return {
                clause(column: string) {
                        return `EXISTS (SELECT 1 FROM "following" ${alias} WHERE ${alias}."followerId" = :${parameterName} AND ${alias}."followeeId" = ${column})`;
                },
                parameters: { [parameterName]: followerId },
        };
}
