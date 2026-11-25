"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import { parseMeasurementColumns, type MeasurementColumn } from "@/lib/measurements-import";
import type { BodyMeasurementInput } from "@/lib/types";

function localDateInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Importing check-ins from a measurements spreadsheet, shared by History's body metrics (phone)
// and the Body page (desktop). Returns the hidden file input, a function that opens the picker,
// and the panel where each spreadsheet column gets its date before importing.
// onSave reports its own errors and resolves false on failure.
export function useMeasurementImport(onSave: (measurement: BodyMeasurementInput) => Promise<boolean>) {
  const { showError } = useError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importColumns, setImportColumns] = useState<MeasurementColumn[] | null>(null);
  const [importDates, setImportDates] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    try {
      const columns = parseMeasurementColumns(await file.arrayBuffer());
      if (columns.length === 0) {
        throw new Error("No measurements found. The spreadsheet needs a \"Measurements\" sheet with filled-in columns.");
      }
      setImportColumns(columns);
      // The first column is the baseline, so it defaults to today; later columns need a date.
      setImportDates(columns.map((_, index) => (index === 0 ? localDateInputValue() : "")));
    } catch (err) {
      showError(err);
    }
  }

  async function confirmImport() {
    if (!importColumns) return;
    setImporting(true);
    try {
      for (let index = 0; index < importColumns.length; index++) {
        if (!importDates[index]) continue;
        const saved = await onSave({
          date: new Date(`${importDates[index]}T12:00:00`),
          ...importColumns[index].values,
        });
        if (!saved) return; // onSave already surfaced the error
      }
      setImportColumns(null);
    } finally {
      setImporting(false);
    }
  }

  const importCount = importDates.filter(Boolean).length;

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".xlsx"
      aria-label="Measurements spreadsheet"
      onChange={handleImportFile}
      className="hidden"
    />
  );

  const panel = (
    <>{importColumns && (
      <div className="mb-3 space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="text-sm font-bold">Import measurements</h3>
        <p className="text-xs text-gray-500">
          Each column becomes a check-in. Set the date it was measured; leave a date blank to skip that column.
        </p>
        {importColumns.map((column, index) => (
          <div key={column.label} className="text-sm text-gray-400">
            <span>{column.label}</span>
            <span className="ml-2 text-xs text-gray-500">
              ({Object.keys(column.values).length} measurements)
            </span>
            <input
              type="date"
              aria-label={`Date for ${column.label}`}
              value={importDates[index] ?? ""}
              onChange={(event) =>
                setImportDates((current) => current.map((value, i) => (i === index ? event.target.value : value)))
              }
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportColumns(null)}
            className="flex-1 rounded-lg border border-gray-700 py-2 text-sm font-semibold hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmImport}
            disabled={importing || importCount === 0}
            className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-bold hover:bg-green-500 disabled:opacity-50"
          >
            {importing ? "Importing…" : `Import ${importCount} check-in${importCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    )}</>
  );

  return { fileInput, open: () => fileInputRef.current?.click(), panel };
}
