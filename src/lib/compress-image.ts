/**
 * Shrinks a phone-camera photo (5–8 MB) to a ~100–250 KB upload before it leaves the device.
 *
 * - createImageBitmap(..., { resizeWidth }) decodes straight to the target size, avoiding a
 *   full 12 MP canvas that can crash 2–3 GB RAM phones.
 * - Safari cannot encode WebP: canvas.toBlob silently returns PNG (bigger than the original!),
 *   so we check blob.type and fall back to JPEG.
 */
export async function compressImage(
	file: File,
	{ maxSide = 1600, quality = 0.75 }: { maxSide?: number; quality?: number } = {}
): Promise<Blob> {
	const probe = await createImageBitmap(file);
	const scale = Math.min(1, maxSide / Math.max(probe.width, probe.height));
	const width = Math.round(probe.width * scale);
	const height = Math.round(probe.height * scale);
	probe.close();

	const bitmap = await createImageBitmap(file, {
		resizeWidth: width,
		resizeHeight: height,
		resizeQuality: 'high'
	});
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
	bitmap.close();

	const encode = (type: string) =>
		new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

	const webp = await encode('image/webp');
	if (webp?.type === 'image/webp') return webp;

	const jpeg = await encode('image/jpeg');
	if (!jpeg) throw new Error('Could not compress image');
	return jpeg;
}
