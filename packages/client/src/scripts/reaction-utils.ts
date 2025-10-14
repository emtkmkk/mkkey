import * as misskey from "calckey-js";
import * as config from "@/config";
import { defaultStore } from "@/store";

type ReactionCountMap = Record<string, number>;

function createReactionMuteMatchers() {
        return defaultStore.state.reactionMutedWords.map((word) => ({
                name: word.replaceAll(":", "").replace("@", ""),
                exact: /^:@?\w+:$/.test(word),
                hostmute: /^:?@[\w.-]/.test(word),
        }));
}

function isMutedReaction(
        reaction: string,
        muteMatchers: ReturnType<typeof createReactionMuteMatchers>,
) {
        const emojiName = reaction
                .replace(":", "")
                .replace(/@[\w:\.\-]+:$/, "");
        const emojiHost = reaction
                .replace(/^:[\w:\.\-]+@/, "")
                .replace(":", "");

        if (
                defaultStore.state.remoteReactionMute &&
                emojiHost &&
                emojiHost !== "." &&
                emojiHost !== config.host
        ) {
                return true;
        }

        return muteMatchers.some((matcher) => {
                if (matcher.exact) {
                        if (matcher.hostmute) {
                                return matcher.name === emojiHost;
                        }
                        return matcher.name === emojiName;
                }

                if (matcher.hostmute) {
                        return emojiHost.includes(matcher.name);
                }

                return emojiName.includes(matcher.name);
        });
}

export function getVisibleReactions(
        note: misskey.entities.Note,
): ReactionCountMap {
        const muteMatchers = createReactionMuteMatchers();
        let reactions: ReactionCountMap = { ...(note.reactions ?? {}) };

        if (note.tags && note.text?.includes("#ゴルベーザ百天王バトル")) {
                if (reactions["🅰️"] == null) {
                        reactions["🅰️"] = 0;
                }
                if (reactions["🅱️"] == null) {
                        reactions["🅱️"] = 0;
                }
        }

        const localReactions = Object.keys(reactions).filter((x) =>
                x.includes("@"),
        );
        const mergedReactions: ReactionCountMap = {};

        localReactions.forEach((localReaction) => {
                const targetReactions = Object.keys(reactions).filter((name) =>
                        name.startsWith(localReaction.replace(/@[\w:\.\-]+:$/, "@")),
                );
                if (targetReactions.length === 0) return;

                let totalCount = 0;
                let maxReaction = {
                        reaction: localReaction,
                        count: reactions[localReaction] ?? 0,
                };

                targetReactions.forEach((name) => {
                        const reactionCount = reactions[name] ?? 0;
                        if (
                                !localReaction.endsWith("@.:") &&
                                maxReaction.count < reactionCount
                        ) {
                                maxReaction = { reaction: name, count: reactionCount };
                        }
                        totalCount += reactionCount;
                        delete reactions[name];
                });

                if (isMutedReaction(maxReaction.reaction, muteMatchers)) {
                        totalCount = 0;
                }

                mergedReactions[maxReaction.reaction] = totalCount;
        });

        const visibleReactions: ReactionCountMap = {
                ...mergedReactions,
                ...reactions,
        };

        Object.keys(visibleReactions).forEach((name) => {
                if (isMutedReaction(name, muteMatchers)) {
                        visibleReactions[name] = 0;
                }
        });

        return visibleReactions;
}

export function getVisibleReactionsTotal(note: misskey.entities.Note): number {
        const reactions = getVisibleReactions(note);
        return Object.values(reactions).reduce((sum, count) => sum + count, 0);
}
