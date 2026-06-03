import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastCtx = createContext(null);

const BG = {
  success: "bg-emerald-600",
  error: "bg-red-600",
  warning: "bg-amber-500",
  info: "bg-blue-600",
};

let _id = 0;

function Item({ toast, onRemove }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  return (
    <div className={`${BG[toast.type] ?? BG.info} text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-start gap-3 min-w-[260px] max-w-[380px]`}>
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="text-white/70 hover:text-white text-lg leading-none mt-0.5 flex-shrink-0">
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <Item key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
