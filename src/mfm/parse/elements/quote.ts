/**
 * Quoted text
 */

export type TextElementQuote = {
	type: 'quote'
	content: string
	quote: string
};

export default function(text: string) {
	const match = text.match(/^"([\s\S]+?)\n"/);
	if (!match) return null;
	const quote = match[0];
	return {
		type: 'quote',
		content: quote,
		quote: match[1].trim(),
	} as TextElementQuote;
}
