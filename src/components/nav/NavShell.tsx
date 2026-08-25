import { ReactNode, ViewTransition } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function NavShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl md:flex-row">
      <Sidebar />
      {/* Top padding has to clear the status bar itself now that the app paints
          edge to edge (viewportFit: "cover" in layout.tsx). Added to the
          existing pt-6 rather than replacing it, so on a device with no inset
          the spacing is unchanged. */}
      <main
        className="min-h-screen w-full flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
      >
        <div className="mx-auto w-full max-w-xl md:max-w-2xl">
          <ViewTransition default="auto">{children}</ViewTransition>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
