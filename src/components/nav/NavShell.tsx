import { ReactNode, ViewTransition } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function NavShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl md:flex-row">
      <Sidebar />
      <main className="min-h-screen w-full flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-xl md:max-w-2xl">
          <ViewTransition default="auto">{children}</ViewTransition>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
