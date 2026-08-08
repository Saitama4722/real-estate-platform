import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

/**
 * THE authentication shell — the split screen every auth surface composes.
 *
 * Server component. Adding a future auth page (password recovery, expired
 * link, set-new-password) means writing ONLY its right-hand panel and dropping
 * it in as `children`; the brand panel, the responsive collapse and the column
 * geometry are settled here once.
 *
 * ≥1025 it is a true split (792px brand / 648px form). ≤1024 the brand panel
 * becomes a header band above a full-width form column — the mockup's §05
 * behaviour, and the reason the form column is `flex-1` rather than fixed.
 *
 * There is no site Header/Footer on these routes: `SiteChrome` in the root
 * layout hides them for auth paths.
 */

interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface min-[1025px]:flex-row">
      <AuthBrandPanel />
      {/* The mockup's 792/648 split is PROPORTIONAL here, not fixed px. Copying
          the literal widths made the page 1440px wide at every viewport, so
          everything from 1025 to 1439 scrolled horizontally [measured]. 55/45
          reproduces the mockup exactly at 1440 and scales everywhere else. */}
      <div className="flex flex-1 items-start justify-center px-5 py-8 min-[1025px]:items-center min-[1025px]:px-16 min-[1025px]:py-14 md:px-8 md:py-14">
        {/* 400px is the mockup's fixed desktop measure; fluid below so the form
            never overflows a 360px viewport. */}
        <div className="w-full max-w-[400px] min-[1025px]:w-[400px]">{children}</div>
      </div>
    </div>
  );
}
