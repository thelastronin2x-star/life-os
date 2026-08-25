"use client";

import { useLongPress } from "@/lib/use-long-press";
import type { ReactNode } from "react";

/** Wraps one Home widget so it can be long-pressed into edit mode (iOS
 *  jiggle-style) and, once there, removed with a small red badge — instead
 *  of every widget block reimplementing its own long-press wiring and
 *  click-suppression, this is the one place that does it. */
export function EditableWidgetBlock({
  editMode,
  onEnterEditMode,
  onRemove,
  children,
}: {
  editMode: boolean;
  onEnterEditMode: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const longPress = useLongPress<null>(() => onEnterEditMode());

  return (
    <div
      className="relative"
      onPointerDown={() => !editMode && longPress.start(null)}
      onPointerUp={longPress.cancel}
      onPointerLeave={longPress.cancel}
      onPointerCancel={longPress.cancel}
      onClickCapture={(e) => {
        // Once a long-press has fired, or we're already in edit mode, taps on
        // the widget itself (its own links/buttons) must not fire — jiggling
        // icons on iOS don't launch the app underneath either. The remove
        // badge is exempt: it's the one tappable thing edit mode is for, and
        // this capture-phase handler runs before the badge's own onClick, so
        // without this check it would swallow every tap on it too.
        const target = e.target as HTMLElement;
        if (target.closest("[data-widget-remove]")) return;
        if (editMode || longPress.wasLongPress()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
      {editMode && (
        <button
          data-widget-remove="true"
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="absolute -right-1.5 -top-1.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-clay text-[12px] font-extrabold text-bg shadow-card"
        >
          ✕
        </button>
      )}
    </div>
  );
}
