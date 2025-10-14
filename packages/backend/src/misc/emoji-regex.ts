import twemoji from "@twemoji/parser/dist/lib/regex.js";
import emojiRegexFactory from "emoji-regex";

const twemojiRegex = twemoji.default;
const generalEmojiRegex = emojiRegexFactory();

export const emojiRegex = new RegExp(`(${twemojiRegex.source})`);
export const emojiRegexAtStartToEnd = new RegExp(`^(${twemojiRegex.source})$`);
export const unicodeEmojiRegex = new RegExp(`(${generalEmojiRegex.source})`);
export const unicodeEmojiRegexAtStartToEnd = new RegExp(
        `^(${generalEmojiRegex.source})$`,
);
