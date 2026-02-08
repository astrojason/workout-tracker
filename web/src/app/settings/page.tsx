"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePrograms } from "@/hooks/usePrograms";
import Link from "next/link";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const {
    programs, settings, currentWeek, setCurrentWeek,
    importCSV, updateUserSettings,
  } = usePrograms(user?.uid ?? null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      await importCSV(text);
      setImportResult(`Imported ${file.name} successfully!`);
    } catch (err) {
      setImportResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Programs */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Programs</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {programs.map((program) => (
            <div key={program.id} className="px-4 py-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{program.name}</div>
                  <div className="text-xs text-gray-500">{program.totalWeeks} weeks</div>
                </div>
                <select
                  value={currentWeek(program.name)}
                  onChange={(e) => setCurrentWeek(program.name, parseInt(e.target.value))}
                  className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm border border-gray-700"
                >
                  {Array.from({ length: program.totalWeeks }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {/* Import */}
          <div className="px-4 py-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition"
            >
              {importing ? "Importing..." : "+ Import CSV Program"}
            </button>
            {importResult && (
              <p className={`text-xs mt-2 ${importResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                {importResult}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Rest Timer */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Rest Timer</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <div className="flex justify-between items-center">
            <span>Default Rest Time</span>
            <select
              value={settings.defaultRestSeconds}
              onChange={(e) => updateUserSettings({ defaultRestSeconds: parseInt(e.target.value) })}
              className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm border border-gray-700"
            >
              <option value={60}>60s</option>
              <option value={90}>90s</option>
              <option value={120}>120s</option>
              <option value={150}>150s</option>
              <option value={180}>180s</option>
            </select>
          </div>
        </div>
      </section>

      {/* Sound */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Notifications</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <div className="flex justify-between items-center">
            <span>Timer Sound</span>
            <button
              onClick={() => updateUserSettings({ soundEnabled: !settings.soundEnabled })}
              className={`w-12 h-7 rounded-full transition relative ${
                settings.soundEnabled ? "bg-indigo-600" : "bg-gray-700"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                  settings.soundEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Account</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-gray-400 text-sm">Signed in as</span>
            <span className="text-sm">{user.email || user.displayName || "Google User"}</span>
          </div>
          <div className="px-4 py-3">
            <button
              onClick={signOut}
              className="text-red-400 hover:text-red-300 text-sm font-semibold transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* Version */}
      <div className="text-center text-xs text-gray-600">
        Workout Tracker v1.0.0
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around">
          <Link href="/" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-xs mt-1">History</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center text-indigo-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
