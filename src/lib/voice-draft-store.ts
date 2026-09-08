import { create } from "zustand";
import type { VoiceClassifyResult } from "./voice-classify-types";

interface VoiceDraftState {
  /** Set right before navigating to a section's page from the voice result
   *  sheet's "Виправити" button — deliberately NOT persisted (no `persist`
   *  middleware): a draft only makes sense for the navigation that just
   *  happened, never across a reload. The target page reads it once on
   *  mount (to prefill its own add-form via the same `draftValues` prop
   *  TradeForm already used for the assistant tool-use flow) and clears it
   *  immediately so re-visiting the page later doesn't reopen a stale form. */
  pendingDraft: VoiceClassifyResult | null;
  setPendingDraft: (draft: VoiceClassifyResult) => void;
  clearPendingDraft: () => void;
}

export const useVoiceDraftStore = create<VoiceDraftState>((set) => ({
  pendingDraft: null,
  setPendingDraft: (draft) => set({ pendingDraft: draft }),
  clearPendingDraft: () => set({ pendingDraft: null }),
}));
