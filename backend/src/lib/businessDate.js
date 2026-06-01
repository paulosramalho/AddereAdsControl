const TZ = "America/Belem";

export function nowBRT() {
  const str = new Date().toLocaleString("en-US", { timeZone: TZ });
  return new Date(str);
}

export function todayBRT() {
  const now = nowBRT();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);
}

export function yesterdayBRT() {
  const d = todayBRT();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function currentMonthBRT() {
  const now = nowBRT();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
  return { start, end };
}
