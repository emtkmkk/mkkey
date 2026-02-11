import { computed, toValue } from "vue";
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

export const useReactionCountViewModel = (
	options: ReactionCountViewModelOptions
) => {
	const totalReactions = computed(() =>
		getVisibleReactionsTotal(toValue(options.note))
	);

	const defaultReactionCount = computed(() => {
		let count = 0;
		const note = toValue(options.note);
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
		toValue(options.isReactionListVisible)
			? defaultReactionCount.value
			: totalReactions.value
	);

	const nonDefaultReactionCount = computed(
		() => totalReactions.value - defaultReactionCount.value
	);

	const showStarAndPickerButtons = computed(
		() =>
			toValue(options.showStarButtonNoEmoji) &&
			(toValue(options.showReactionPickerButton) ||
				toValue(options.showUndoReactionButton))
	);

	const useSplitReactionCounts = computed(
		() =>
			showStarAndPickerButtons.value ||
			(toValue(options.isStarButtonHandlesDefault) &&
				toValue(options.showReactionPickerButton) &&
				toValue(options.showUndoReactionButton))
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
		!toValue(options.showStarButtonNoEmoji) && useSplitReactionCounts.value
			? defaultReactionCount.value
			: countForPickerButton.value
	);

	const countForUndoReactionButton = computed(() =>
		!toValue(options.showStarButtonNoEmoji) && useSplitReactionCounts.value
			? nonDefaultReactionCount.value
			: countForPickerButton.value
	);

	const canShowReactionCount = computed(
		() =>
			!(useSplitReactionCounts.value && toValue(options.isReactionListVisible))
	);

	const showReactionPickerCount = computed(
		() =>
			canShowReactionCount.value &&
			toValue(options.showReactionPickerButton) &&
			countForReactionPickerButton.value > 0
	);

	const showUndoReactionCount = computed(
		() =>
			canShowReactionCount.value &&
			toValue(options.showUndoReactionButton) &&
			countForUndoReactionButton.value > 0
	);

	const tooltipQuery = computed(() => {
		if (
			useSplitReactionCounts.value &&
			toValue(options.isReactionListVisible)
		) {
			return { shouldSkip: true };
		}

		const type = useSplitReactionCounts.value
			? null
			: toValue(options.isReactionListVisible)
			? instance.defaultReaction
			: null;

		const excludeType = useSplitReactionCounts.value
			? instance.defaultReaction
			: null;

		const count = useSplitReactionCounts.value
			? nonDefaultReactionCount.value
			: toValue(options.isReactionListVisible)
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
