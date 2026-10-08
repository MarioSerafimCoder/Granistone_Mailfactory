import test from 'node:test';
import assert from 'node:assert/strict';
import { baseCropRect, cropControlsFromRect, cropHandles, cropOutputSize, cropRectFromControls, fitCropRectToRatio, moveCropRect, resizeCropRect } from '../lib/image-crop';

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

test('unlocked edges and corners change aspect ratio without leaving the photo', () => {
  const initial = baseCropRect(600, 900, 1200, 700);
  const edge = resizeCropRect(initial, 'e', -100, 300, 600, 900, 1200, 700, false);
  assert.equal(edge.height, initial.height);
  assert.equal(edge.top, initial.top);
  assert.ok(edge.width < initial.width);
  assert.notEqual(edge.width / edge.height, 1200 / 700);
  const corner = resizeCropRect(edge, 'se', -50, 100, 600, 900, 1200, 700, false);
  assert.ok(corner.width < edge.width);
  assert.ok(corner.height > edge.height);
  assert.ok(corner.left >= 0 && corner.top >= 0);
  assert.ok(corner.left + corner.width <= 600 && corner.top + corner.height <= 900);
  const output = cropOutputSize(corner, 1200, 700, false);
  assert.ok(Math.abs(output.width / output.height - corner.width / corner.height) < .005);
  assert.notDeepEqual(output, { width: 1200, height: 700 });
  const relocked = fitCropRectToRatio(corner, 1200, 700);
  assert.ok(Math.abs(relocked.width / relocked.height - 1200 / 700) < 1e-10);
  assert.ok(relocked.left >= corner.left && relocked.top >= corner.top);
  assert.ok(relocked.left + relocked.width <= corner.left + corner.width + 1e-10);
  assert.ok(relocked.top + relocked.height <= corner.top + corner.height + 1e-10);
});
