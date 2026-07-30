"use client";

/** Which build is actually running, visible from inside the app.
 *
 *  Exists because "the deploy came but nothing changed" is otherwise
 *  indistinguishable from "the change didn't do what I expected" — from a
 *  phone, a stale build and a working build look exactly the same. With the
 *  commit visible here, that question is answered by comparing it to the
 *  latest commit, instead of guessing.
 *
 *  Values are inlined at build time (see next.config.ts). Locally they're
 *  empty, so it says so rather than showing a blank. */
export function BuildInfo() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

  const shortSha = sha ? sha.slice(0, 7) : null;
  const builtAtLabel = builtAt
    ? new Date(builtAt).toLocaleString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mb-4 text-center text-[10px] leading-relaxed text-text-faint">
      {shortSha ? (
        <>
          Збірка <span className="font-mono">{shortSha}</span>
          {builtAtLabel && ` · ${builtAtLabel}`}
        </>
      ) : (
        "Локальна збірка"
      )}
    </div>
  );
}
