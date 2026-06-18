"use client";

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  confirmClassName?: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  title,
  message,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting...",
  confirmClassName = "bg-red-600 hover:bg-red-500",
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 border border-gray-800">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={`flex-1 py-3 rounded-xl font-bold transition disabled:opacity-50 ${confirmClassName}`}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
