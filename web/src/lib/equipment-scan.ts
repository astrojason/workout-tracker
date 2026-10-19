import { auth } from "@/lib/firebase";
import { summarizeHistory, type EquipmentAnalysis, type EquipmentHint } from "@/lib/equipment-photo";
import type { WorkoutSessionDoc } from "@/lib/types";

const MAX_DIMENSION = 1024;

// Downscales to a JPEG data URL so a phone photo (several MB) doesn't go over the wire as-is.
export async function fileToScaledDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo (no canvas support)");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

// Identifies the exercise from the typed name (and brand) alone, for when there is no usable photo.
export async function identifyEquipment(sessions: WorkoutSessionDoc[], hint: EquipmentHint): Promise<EquipmentAnalysis> {
  return requestAnalysis({ history: summarizeHistory(sessions), hint });
}

// Sends the photo (plus any typed name/brand) and a summary of the user's history to the server
// and returns the AI's analysis.
export async function scanEquipmentPhoto(file: File, sessions: WorkoutSessionDoc[], hint?: EquipmentHint): Promise<EquipmentAnalysis> {
  const image = await fileToScaledDataUrl(file);
  return requestAnalysis({ image, history: summarizeHistory(sessions), hint });
}

async function requestAnalysis(payload: { image?: string; history: unknown; hint?: EquipmentHint }): Promise<EquipmentAnalysis> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to scan equipment");
  const res = await fetch("/api/equipment-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as EquipmentAnalysis & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Equipment scan failed (${res.status})`);
  return body;
}
