export function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        {message && <p className="text-slate-400 text-sm mb-6">{message}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
