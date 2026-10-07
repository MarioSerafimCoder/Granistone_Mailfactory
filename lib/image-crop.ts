export type CropRect = { left: number; top: number; width: number; height: number };
export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const cropHandles: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function baseCropRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropRect {
  const ratio = targetWidth / targetHeight;
  const width = Math.min(sourceWidth, sourceHeight * ratio);
  const height = width / ratio;
  return { left: (sourceWidth - width) / 2, top: (sourceHeight - height) / 2, width, height };
}

export function cropRectFromControls(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, zoom: number, x: number, y: number): CropRect {
  const base = baseCropRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  const width = base.width / clamp(zoom, 1, 8);
  const height = base.height / clamp(zoom, 1, 8);
  return { left: (sourceWidth - width) * clamp(x, 0, 100) / 100, top: (sourceHeight - height) * clamp(y, 0, 100) / 100, width, height };
}

export function cropControlsFromRect(rect: CropRect, sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const base = baseCropRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  return {
    zoom: clamp(base.width / rect.width, 1, 8),
    x: sourceWidth - rect.width > .001 ? clamp(rect.left / (sourceWidth - rect.width) * 100, 0, 100) : 50,
    y: sourceHeight - rect.height > .001 ? clamp(rect.top / (sourceHeight - rect.height) * 100, 0, 100) : 50,
  };
}

export function moveCropRect(rect: CropRect, dx: number, dy: number, sourceWidth: number, sourceHeight: number): CropRect {
  return { ...rect, left: clamp(rect.left + dx, 0, sourceWidth - rect.width), top: clamp(rect.top + dy, 0, sourceHeight - rect.height) };
}

export function resizeCropRect(rect: CropRect, handle: CropHandle, dx: number, dy: number, sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropRect {
  const ratio = targetWidth / targetHeight;
  const baseWidth = baseCropRect(sourceWidth, sourceHeight, targetWidth, targetHeight).width;
  const right = rect.left + rect.width, bottom = rect.top + rect.height;
  const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
  const horizontal = handle.includes('e') ? dx : -dx;
  const vertical = (handle.includes('s') ? dy : -dy) * ratio;
  const delta = handle === 'e' || handle === 'w' ? horizontal : handle === 'n' || handle === 's' ? vertical : Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
  let maxWidth = baseWidth;
  if (handle.includes('e')) maxWidth = Math.min(maxWidth, sourceWidth - rect.left);
  if (handle.includes('w')) maxWidth = Math.min(maxWidth, right);
  if (handle.includes('n')) maxWidth = Math.min(maxWidth, bottom * ratio);
  if (handle.includes('s')) maxWidth = Math.min(maxWidth, (sourceHeight - rect.top) * ratio);
  if (handle === 'e' || handle === 'w') maxWidth = Math.min(maxWidth, 2 * Math.min(centerY, sourceHeight - centerY) * ratio);
  if (handle === 'n' || handle === 's') maxWidth = Math.min(maxWidth, 2 * Math.min(centerX, sourceWidth - centerX));
  const width = clamp(rect.width + delta, Math.min(baseWidth / 8, maxWidth), maxWidth);
  const height = width / ratio;
  const left = handle === 'n' || handle === 's' ? centerX - width / 2 : handle.includes('w') ? right - width : rect.left;
  const top = handle === 'e' || handle === 'w' ? centerY - height / 2 : handle.includes('n') ? bottom - height : rect.top;
  return { left: clamp(left, 0, sourceWidth - width), top: clamp(top, 0, sourceHeight - height), width, height };
}
