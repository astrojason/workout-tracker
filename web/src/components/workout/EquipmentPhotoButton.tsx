"use client";

import { useRef, useState } from "react";
import type { EquipmentAnalysis } from "@/lib/equipment-photo";
import { useError } from "@/components/providers/ErrorProvider";

interface EquipmentPhotoButtonProps {
  onScan: (file: File) => Promise<EquipmentAnalysis>;
  onResult: (analysis: EquipmentAnalysis) => void;
}

// Lets the user snap or pick a photo of a machine/equipment; the AI names the exercise and
// suggests a working weight from their history. The parent decides what to do with the result.
export function EquipmentPhotoButton({ onScan, onResult }: EquipmentPhotoButtonProps) {
  const { showError } = useError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState<EquipmentAnalysis | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError(new Error("Please choose an image file"));
      return;
    }
    setScanning(true);
    try {
      const analysis = await onScan(file);
      setLast(analysis);
      onResult(analysis);
    } catch (err) {
      showError(err);
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mb-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        data-testid="equipment-photo-input"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
        className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition disabled:opacity-50"
      >
        {scanning ? "Analyzing photo…" : "📷 Scan equipment photo"}
      </button>
      {last && (
        <p className="mt-2 text-xs text-gray-400">
          Identified <span className="text-gray-200">{last.name}</span>
          {last.suggestedWeight !== null && <> · suggested {last.suggestedWeight} lbs</>}
          {last.reasoning && <> — {last.reasoning}</>}
        </p>
      )}
    </div>
  );
}
