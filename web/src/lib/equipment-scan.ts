import { auth } from "@/lib/firebase";
import { summarizeHistory, type EquipmentAnalysis } from "@/lib/equipment-photo";
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

// Sends the photo plus a summary of the user's history to the server and returns the AI's analysis.
export async function scanEquipmentPhoto(file: File, sessions: WorkoutSessionDoc[]): Promise<EquipmentAnalysis> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to scan equipment");
  const image = await fileToScaledDataUrl(file);
  const res = await fetch("/api/equipment-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image, history: summarizeHistory(sessions) }),
  });
  const body = (await res.json()) as EquipmentAnalysis & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Equipment scan failed (${res.status})`);
  return body;
}
