import { computed, unref } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type * as misskey from "calckey-js";
import { instance } from "@/instance";
import {
	getVisibleReactionsTotal,
	normalizeReactionName,
} from "@/scripts/reaction-utils";

export type ReactionCountViewModelOptions = {
	note: MaybeRefOrGetter<misskey.entities.Note>;
	isReactionListVisible: MaybeRefOrGetter<boolean>;
	showStarButtonNoEmoji: MaybeRefOrGetter<boolean>;
	showReactionPickerButton: MaybeRefOrGetter<boolean>;
	showUndoReactionButton: MaybeRefOrGetter<boolean>;
	isStarButtonHandlesDefault: MaybeRefOrGetter<boolean>;
};

const resolveMaybeRefOrGetter = <T>(
	value: MaybeRefOrGetter<T>
): T => {
	if (typeof value === "function") {
		return value();
	}

	return unref(value);
};

export const useReactionCountViewModel = (
	options: ReactionCountViewModelOptions
) => {
	const totalReactions = computed(() =>
		getVisibleReactionsTotal(resolveMaybeRefOrGetter(options.note))
	);

	const defaultReactionCount = computed(() => {
		let count = 0;
		const note = resolveMaybeRefOrGetter(options.note);
		if (note.reactions) {
			for (const reaction of Object.keys(note.reactions)) {
				if (normalizeReactionName(reaction) === instance.defaultReaction) {
					count += note.reactions[reaction];
				}
			}
		}
		return count;
	});

	const reactionCountToShow = computed(() =>
		resolveMaybeRefOrGetter(options.isReactionListVisible)
			? defaultReactionCount.value
			: totalReactions.value
	);

	const nonDefaultReactionCount = computed(
		() => totalReactions.value - defaultReactionCount.value
	);

	const showStarAndPickerButtons = computed(
		() =>
			resolveMaybeRefOrGetter(options.showStarButtonNoEmoji) &&
			(resolveMaybeRefOrGetter(options.showReactionPickerButton) ||
				resolveMaybeRefOrGetter(options.showUndoReactionButton))
	);

	const useSplitReactionCounts = computed(
		() =>
			showStarAndPickerButtons.value ||
			(resolveMaybeRefOrGetter(options.isStarButtonHandlesDefault) &&
				resolveMaybeRefOrGetter(options.showReactionPickerButton) &&
				resolveMaybeRefOrGetter(options.showUndoReactionButton))
	);

	const countForStarButton = computed(() =>
		useSplitReactionCounts.value
			? defaultReactionCount.value
			: reactionCountToShow.value
	);

	const showStarCount = computed(() => countForStarButton.value > 0);

	const countForPickerButton = computed(() =>
		useSplitReactionCounts.value
			? nonDefaultReactionCount.value
			: reactionCountToShow.value
	);

	const countForReactionPickerButton = computed(() =>
		!resolveMaybeRefOrGetter(options.showStarButtonNoEmoji) &&
		useSplitReactionCounts.value
			? defaultReactionCount.value
			: countForPickerButton.value
	);

	const countForUndoReactionButton = computed(() =>
		!resolveMaybeRefOrGetter(options.showStarButtonNoEmoji) &&
		useSplitReactionCounts.value
			? nonDefaultReactionCount.value
			: countForPickerButton.value
	);

	const canShowReactionCount = computed(
		() =>
			!(
				useSplitReactionCounts.value &&
				resolveMaybeRefOrGetter(options.isReactionListVisible)
			)
	);

	const showReactionPickerCount = computed(
		() =>
			canShowReactionCount.value &&
			resolveMaybeRefOrGetter(options.showReactionPickerButton) &&
			countForReactionPickerButton.value > 0
	);

	const showUndoReactionCount = computed(
		() =>
			canShowReactionCount.value &&
			resolveMaybeRefOrGetter(options.showUndoReactionButton) &&
			countForUndoReactionButton.value > 0
	);

	const tooltipQuery = computed(() => {
		if (
			useSplitReactionCounts.value &&
			resolveMaybeRefOrGetter(options.isReactionListVisible)
		) {
			return { shouldSkip: true };
		}

		const type = useSplitReactionCounts.value
			? null
			: resolveMaybeRefOrGetter(options.isReactionListVisible)
			? instance.defaultReaction
			: null;

		const excludeType = useSplitReactionCounts.value
			? instance.defaultReaction
			: null;

		const count = useSplitReactionCounts.value
			? nonDefaultReactionCount.value
			: resolveMaybeRefOrGetter(options.isReactionListVisible)
			? defaultReactionCount.value
			: totalReactions.value;

		return {
			shouldSkip: false,
			type,
			excludeType,
			count,
		};
	});

	const reactionCountViewModel = computed(() => ({
		useSplitReactionCounts: useSplitReactionCounts.value,
		canShowReactionCount: canShowReactionCount.value,
		showStarCount: showStarCount.value,
		countForStarButton: countForStarButton.value,
		countForReactionPickerButton: countForReactionPickerButton.value,
		countForUndoReactionButton: countForUndoReactionButton.value,
		showReactionPickerCount: showReactionPickerCount.value,
		showUndoReactionCount: showUndoReactionCount.value,
		tooltipQuery: tooltipQuery.value,
	}));

	return {
		totalReactions,
		defaultReactionCount,
		nonDefaultReactionCount,
		reactionCountViewModel,
	};
};
