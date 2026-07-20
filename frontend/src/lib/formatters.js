export function brlFromCentavos(cents) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtDateTimeSeconds(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const day = date.toLocaleDateString("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const time = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Belem",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return `${day} ${time}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function isoToDateTimeLocal(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-") + `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function dateTimeLocalToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
