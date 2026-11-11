// Keep one disk write in flight and only the latest waiting snapshot. Each
// caller resolves after its snapshot (or a newer one) is safely written.
export function localSaveQueue<T>(write: (snapshot: T) => Promise<void>) {
  let pending: { value: T } | undefined;
  let tail = Promise.resolve();
  return (value: T): Promise<void> => {
    pending = { value };
    tail = tail.catch(() => {}).then(async () => {
      const entry = pending;
      if (!entry) return;
      await write(entry.value);
      if (pending === entry) pending = undefined;
    });
    return tail;
  };
}
