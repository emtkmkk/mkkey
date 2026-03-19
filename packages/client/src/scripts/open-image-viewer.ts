export async function openImageViewer(targetUrl: string): Promise<void> {
	await import("photoswipe/style.css");
	const [pswp, pswpLightbox] = await Promise.all([
		import("photoswipe"),
		import("photoswipe/lightbox"),
	]);

	await new Promise<void>((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const lightbox = new pswpLightbox.default({
				dataSource: [
					{
						src: targetUrl,
						w: img.naturalWidth,
						h: img.naturalHeight,
					},
				],
				pswpModule: pswp.default,
				loop: false,
				padding:
					window.innerWidth > 500
						? { top: 32, bottom: 32, left: 32, right: 32 }
						: { top: 0, bottom: 0, left: 0, right: 0 },
			});
			lightbox.on("close", () => lightbox.destroy());
			lightbox.init();
			lightbox.loadAndOpen(0);
			resolve();
		};
		img.onerror = () => reject(new Error("Failed to load image viewer target."));
		img.src = targetUrl;
	});
}
