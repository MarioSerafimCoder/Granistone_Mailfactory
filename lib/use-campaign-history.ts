'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Campaign, Language } from '@/types/campaign';
import { editCampaign } from '@/campaigns/model';
import { campaignFingerprint as fingerprint, historyOf, mergeCampaignPatch, rebaseHostedImages, recordHistory, stepHistory } from './canvas-model';

export function useCampaignHistory(campaign: Campaign, language: Language, readOnly: boolean, onChange: (c: Campaign) => void) {
  const history = useRef(historyOf(campaign));
  const current = useRef(campaign);
  const [available, setAvailable] = useState({ undo: false, redo: false, signature: fingerprint(campaign) });
  useLayoutEffect(() => {
    let cancelled = false;
    const publishAvailability = () => {
      const next = { undo: !!history.current.past.length, redo: !!history.current.future.length, signature: fingerprint(campaign) };
      queueMicrotask(() => { if (!cancelled) setAvailable(next); });
    };
    // A remote revision or a restored shared version starts a new local history.
    if (readOnly) { history.current = historyOf(campaign); publishAvailability(); }
    else if (fingerprint(campaign) !== fingerprint(current.current)) {
      const rebased = rebaseHostedImages(history.current, current.current, campaign);
      history.current = rebased ?? historyOf(campaign);
      // Normalization is an external update, not a user history operation.
      publishAvailability();
    }
    current.current = campaign;
    return () => { cancelled = true; };
  }, [campaign, readOnly]);
  const change = (patch: Partial<Campaign>, group?: string) => {
    if (readOnly) return;
    const next = editCampaign(current.current, mergeCampaignPatch(campaign, current.current, patch), language);
    history.current = recordHistory({ ...history.current, present: current.current }, next, group);
    current.current = next; onChange(next); setAvailable({ undo: !!history.current.past.length, redo: false, signature: fingerprint(next) });
  };
  const step = (redo = false) => {
    if (readOnly) return;
    const next = stepHistory(history.current, redo);
    if (next === history.current) return;
    // Restoring content never restores stale approval or publication status.
    const restored = editCampaign(current.current, { ...next.present, status: undefined, languageState: current.current.languageState });
    history.current = { ...next, present: restored }; current.current = restored;
    onChange(restored); setAvailable({ undo: !!next.past.length, redo: !!next.future.length, signature: fingerprint(restored) });
  };
  const valid = !readOnly && available.signature === fingerprint(campaign);
  return { change, undo: () => step(), redo: () => step(true), canUndo: valid && available.undo, canRedo: valid && available.redo };
}
