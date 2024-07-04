export default (v, digits = 0, minDigits = 3) => {
	if (v == null) return "?";
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	if (v === 0) return "0";
	const isMinus = v < 0;
	if (isMinus) v = -v;
	let i = Math.floor(Math.log(v) / Math.log(1024));
	while (i > 0 && (v / 1024 ** i).toFixed(digits).replace(".","").length < minDigits) {
		i -= 1
	}
	return (
		(isMinus ? "-" : "") +
		(v / 1024 ** i).toFixed(digits).replace(/\.0+$/, "") +
		sizes[i]
	);
};
