import { notFound } from "next/navigation";
import { GymMachinesPreview } from "./GymMachinesPreview";

export default function GymMachinesTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();
  return <GymMachinesPreview />;
}
