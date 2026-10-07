import test from 'node:test';
import assert from 'node:assert/strict';
import { baseCropRect, cropControlsFromRect, cropHandles, cropRectFromControls, moveCropRect, resizeCropRect } from '../lib/image-crop';

test('manual crop handles keep the requested aspect ratio and stay inside the source', () => {
  const sourceWidth = 600, sourceHeight = 900, targetWidth = 1200, targetHeight = 700;
  const centered = baseCropRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  for (const handle of cropHandles) {
    const resized = resizeCropRect(centered, handle, -80, -60, sourceWidth, sourceHeight, targetWidth, targetHeight);
    assert.ok(resized.width > 0 && resized.height > 0, handle);
    assert.ok(Math.abs(resized.width / resized.height - targetWidth / targetHeight) < 1e-10, handle);
    assert.ok(resized.left >= 0 && resized.top >= 0, handle);
    assert.ok(resized.left + resized.width <= sourceWidth + 1e-10, handle);
    assert.ok(resized.top + resized.height <= sourceHeight + 1e-10, handle);
  }
  const inward = resizeCropRect(centered, 'se', -90, -80, sourceWidth, sourceHeight, targetWidth, targetHeight);
  assert.ok(inward.width < centered.width);
  assert.equal(inward.left, centered.left);
  assert.equal(inward.top, centered.top);
  const moved = moveCropRect(inward, 9999, 9999, sourceWidth, sourceHeight);
  assert.ok(Math.abs(moved.left + moved.width - sourceWidth) < 1e-10);
  assert.ok(Math.abs(moved.top + moved.height - sourceHeight) < 1e-10);
});

test('manual crop converts to quick controls without changing the selected pixels', () => {
  const rect = resizeCropRect(baseCropRect(600, 900, 1200, 700), 'se', -115, -50, 600, 900, 1200, 700);
  const moved = moveCropRect(rect, 60, 80, 600, 900);
  const controls = cropControlsFromRect(moved, 600, 900, 1200, 700);
  const recovered = cropRectFromControls(600, 900, 1200, 700, controls.zoom, controls.x, controls.y);
  for (const key of ['left', 'top', 'width', 'height'] as const) assert.ok(Math.abs(recovered[key] - moved[key]) < 1e-9, key);
});
