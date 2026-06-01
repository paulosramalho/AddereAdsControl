function fmt(cents) {
  const abs = Math.abs(cents ?? 0);
  const s = String(abs).padStart(3, "0");
  const intPart = s.slice(0, -2).replace(/^0+/, "") || "0";
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + "," + s.slice(-2);
}

export function MoneyInput({ value, onChange, placeholder = "0,00", className = "", disabled = false }) {
  function handleKeyDown(e) {
    if (disabled) return;
    const curr = value ?? 0;
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const next = curr * 10 + Number(e.key);
      if (next <= 999_999_999) onChange(next);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      onChange(Math.floor(curr / 10));
    } else if (e.key === "Delete") {
      e.preventDefault();
      onChange(0);
    }
  }

  return (
    <input
      type="text"
      readOnly
      value={value ? fmt(value) : ""}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`input-base ${className}`}
    />
  );
}
