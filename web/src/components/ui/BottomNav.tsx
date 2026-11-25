import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

type ActiveTab = "home" | "history" | "body" | "equipment" | "settings" | null;

// One nav for every width: a compact bar fixed to the bottom on phones, and a top bar with the
// app name and signed-in email on desktop (lg, 1024px+). globals.css reserves its height.
export function BottomNav({ active, email }: { active: ActiveTab; email?: string | null }) {
  const cls = (tab: ActiveTab) =>
    `flex flex-col items-center lg:flex-row lg:gap-2 lg:px-3 lg:py-2 lg:rounded-lg ${
      active === tab ? "text-indigo-400 lg:bg-gray-800" : "text-gray-500 hover:text-gray-300"
    }`;
  const label = "text-[11px] mt-0.5 lg:text-sm lg:font-semibold lg:mt-0";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 px-4 pt-2 pb-[max(0.25rem,calc(env(safe-area-inset-bottom)*0.4))] lg:top-0 lg:bottom-auto lg:h-14 lg:border-t-0 lg:border-b lg:px-8 lg:py-0">
      <div className="max-w-lg mx-auto flex items-center justify-around lg:max-w-none lg:h-full lg:justify-start lg:gap-9">
        <Link href="/" className="hidden lg:flex items-center gap-2.5 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="w-7 h-7" />
          <span className="font-bold text-[15px]">Workout Tracker</span>
        </Link>
        {/* On phones the tabs are direct items of the evenly spaced row; on desktop they group. */}
        <div className="contents lg:flex lg:items-center lg:gap-1">
          <Link href="/" className={cls("home")}>
            <svg className="w-5 h-5 lg:w-[18px] lg:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            <span className={label}>Home</span>
          </Link>
          <Link href="/history" className={cls("history")}>
            <svg className="w-5 h-5 lg:w-[18px] lg:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className={label}>History</span>
          </Link>
          {/* Body and Equipment are desktop only: phones reach them from History and Settings. */}
          <Link href="/body" className={cls("body").replace("flex flex-col", "hidden lg:flex flex-col")}>
            <svg className="w-5 h-5 lg:w-[18px] lg:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6a2 2 0 100-4 2 2 0 000 4zM5 9l7 1 7-1M12 10v5m0 0l-3 7m3-7l3 7" /></svg>
            <span className={label}>Body</span>
          </Link>
          <Link href="/equipment" className={cls("equipment").replace("flex flex-col", "hidden lg:flex flex-col")}>
            <svg className="w-5 h-5 lg:w-[18px] lg:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" /></svg>
            <span className={label}>Equipment</span>
          </Link>
          <Link href="/settings" className={cls("settings")}>
            <svg className="w-5 h-5 lg:w-[18px] lg:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className={label}>Settings</span>
          </Link>
        </div>
        <div className="hidden lg:block lg:flex-1" />
        {email && <span className="hidden lg:inline text-xs text-gray-500">{email}</span>}
        <Link href="/changelog" className="text-[10px] text-gray-600 hover:text-gray-400 lg:text-xs">
          v{APP_VERSION}
        </Link>
      </div>
    </nav>
  );
}
