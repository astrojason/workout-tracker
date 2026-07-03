"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useError } from "@/components/providers/ErrorProvider";
import { usePrograms } from "@/hooks/usePrograms";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { showError } = useError();
  const {
    activePrograms, archivedPrograms, settings, currentWeek, setCurrentWeek,
    importXLSX, reimportProgram, archiveProgram, unarchiveProgram, deleteProgram, updateUserSettings,
  } = usePrograms(user?.uid ?? null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reimportFileInputRef = useRef<HTMLInputElement>(null);

  // Import flow state
  type PendingImport = { file: File; buffer: ArrayBuffer; defaultName: string };
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [reimportingId, setReimportingId] = useState<string | null>(null);
  // Tracks which program the re-import file picker was opened for
  const reimportTargetRef = useRef<{ id: string; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const defaultName = file.name.replace(/\.xlsx$/i, "").replace(/[-_]/g, " ");
    const buffer = await file.arrayBuffer();
    setPendingImport({ file, buffer, defaultName });
    setImportName(defaultName);
    setImportResult(null);
  }

  async function handleConfirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    setImportResult(null);
    try {
      await importXLSX(pendingImport.buffer, importName.trim() || pendingImport.defaultName);
      setImportResult(`Imported "${importName.trim() || pendingImport.defaultName}" successfully!`);
      setPendingImport(null);
    } catch (err) {
      showError(err);
      setImportResult("Import failed — see error details.");
    } finally {
      setImporting(false);
    }
  }

  async function handleReimportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !reimportTargetRef.current) return;
    if (reimportFileInputRef.current) reimportFileInputRef.current.value = "";
    const { id, name } = reimportTargetRef.current;
    reimportTargetRef.current = null;
    setReimportingId(id);
    try {
      const data = await file.arrayBuffer();
      await reimportProgram(id, name, data);
      setImportResult(`Re-imported "${name}" successfully!`);
    } catch (err) {
      showError(err);
      setImportResult("Re-import failed — see error details.");
    } finally {
      setReimportingId(null);
    }
  }

  async function handleDelete(programId: string, programName: string) {
    setDeletingId(programId);
    try {
      await deleteProgram(programId, programName);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleArchive(programId: string) {
    setArchivingId(programId);
    setConfirmArchiveId(null);
    try {
      await archiveProgram(programId);
    } finally {
      setArchivingId(null);
    }
  }

  async function handleUnarchive(programId: string) {
    setArchivingId(programId);
    try {
      await unarchiveProgram(programId);
    } finally {
      setArchivingId(null);
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
        <input
          ref={reimportFileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleReimportFileSelect}
          className="hidden"
        />
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {activePrograms.map((program) => (
            <div key={program.id} className="px-4 py-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{program.name}</div>
                  <div className="text-xs text-gray-500">{program.totalWeeks} weeks</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={currentWeek(program.name)}
                    onChange={(e) => setCurrentWeek(program.name, parseInt(e.target.value))}
                    className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm border border-gray-700"
                  >
                    {Array.from({ length: program.totalWeeks }, (_, i) => i + 1).map((w) => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      reimportTargetRef.current = { id: program.id, name: program.name };
                      reimportFileInputRef.current?.click();
                    }}
                    disabled={reimportingId === program.id}
                    className="text-gray-600 hover:text-blue-400 transition p-1"
                    title="Re-import program file"
                  >
                    {reimportingId === program.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                  </button>
                  <Link
                    href={`/programs/${program.id}`}
                    className="text-gray-600 hover:text-indigo-400 transition p-1"
                    title="Edit exercises"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => setConfirmArchiveId(program.id)}
                    disabled={archivingId === program.id}
                    className="text-gray-600 hover:text-yellow-400 transition p-1"
                    title="Archive program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(program.id)}
                    disabled={deletingId === program.id}
                    className="text-gray-600 hover:text-red-400 transition p-1"
                    title="Delete program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Import */}
          <div className="px-4 py-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            {pendingImport ? (
              <div>
                <p className="text-sm text-gray-300 mb-2">Name this program:</p>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
                  placeholder="Program name"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPendingImport(null); setImportResult(null); }}
                    className="px-3 py-1.5 text-xs bg-gray-800 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="px-3 py-1.5 text-xs bg-indigo-600 rounded-lg hover:bg-indigo-500 font-semibold transition"
                  >
                    {importing ? "Importing..." : "Import"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition"
              >
                + Import Program (XLSX)
              </button>
            )}
            {importResult && (
              <p className={`text-xs mt-2 ${importResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                {importResult}
              </p>
            )}
          </div>
        </div>

        {/* Archived Programs */}
        {archivedPrograms.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-400 transition flex items-center gap-1"
            >
              <svg className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {archivedPrograms.length} archived program{archivedPrograms.length !== 1 ? "s" : ""}
            </button>
            {showArchived && (
              <div className="mt-2 bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
                {archivedPrograms.map((program) => (
                  <div key={program.id} className="px-4 py-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-400">{program.name}</div>
                        <div className="text-xs text-gray-600">{program.totalWeeks} weeks · archived</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUnarchive(program.id)}
                          disabled={archivingId === program.id}
                          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition font-semibold"
                        >
                          {archivingId === program.id ? "..." : "Reactivate"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(program.id)}
                          disabled={deletingId === program.id}
                          className="text-gray-600 hover:text-red-400 transition p-1"
                          title="Delete program"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

      {/* Equipment */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Equipment</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <Link
            href="/settings/equipment"
            className="px-4 py-3 flex justify-between items-center hover:bg-gray-800/50 transition rounded-xl"
          >
            <span>Manage Equipment</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
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

      {confirmArchiveId && (() => {
        const program = activePrograms.find((p) => p.id === confirmArchiveId);
        return program ? (
          <ConfirmDeleteModal
            title="Archive Program"
            message={`Archive "${program.name}"? It will move to the archived list and won't appear on the home screen.`}
            confirmLabel="Archive"
            confirmingLabel="Archiving..."
            confirmClassName="bg-yellow-600 hover:bg-yellow-500"
            isConfirming={archivingId === confirmArchiveId}
            onCancel={() => setConfirmArchiveId(null)}
            onConfirm={() => handleArchive(program.id)}
          />
        ) : null;
      })()}

      {confirmDeleteId && (() => {
        const program = [...activePrograms, ...archivedPrograms].find((p) => p.id === confirmDeleteId);
        return program ? (
          <ConfirmDeleteModal
            title="Delete Program"
            message={`Delete "${program.name}"? This removes all workouts but keeps history.`}
            isConfirming={deletingId === confirmDeleteId}
            onCancel={() => setConfirmDeleteId(null)}
            onConfirm={() => handleDelete(program.id, program.name)}
          />
        ) : null;
      })()}

      <BottomNav active="settings" />
    </div>
  );
}
