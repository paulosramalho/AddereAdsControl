const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_CLS = {
  DRAFT:      "bg-slate-600/80 text-slate-200",
  SCHEDULED:  "bg-blue-700/70 text-blue-100",
  PUBLISHING: "bg-amber-700/70 text-amber-100",
  PUBLISHED:  "bg-emerald-700/70 text-emerald-100",
  FAILED:     "bg-red-700/70 text-red-100",
  CANCELLED:  "bg-slate-700/40 text-slate-500 line-through",
};

function sameDay(a, b) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export default function CalendarGrid({ posts = [], month, onPrevMonth, onNextMonth, onClickPost, onAddClick }) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const monthName = month.toLocaleString("pt-BR", { timeZone: "America/Belem", month: "long", year: "numeric" });
  const monthLabel = monthName.charAt(0).toLocaleUpperCase("pt-BR") + monthName.slice(1);
  const startOffset = new Date(year, monthIdx, 1).getDay();
  const today = new Date();

  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, monthIdx, i - startOffset + 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onPrevMonth}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition text-sm"
        >
          ←
        </button>
        <span className="text-white font-medium">{monthLabel}</span>
        <button
          onClick={onNextMonth}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition text-sm"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-700/40 rounded-xl overflow-hidden border border-slate-700/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-slate-900 text-center text-xs text-slate-500 py-2 font-medium">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          const isCurrentMonth = date.getMonth() === monthIdx;
          const isToday = sameDay(date, today);
          const dayPosts = posts.filter((p) => sameDay(new Date(p.scheduledAt), date));

          return (
            <div
              key={i}
              onClick={() => isCurrentMonth && onAddClick && onAddClick(date)}
              className={`bg-slate-800/80 min-h-[88px] p-1.5 flex flex-col gap-1 transition ${
                isCurrentMonth
                  ? "cursor-pointer hover:bg-slate-700/60"
                  : "opacity-25 cursor-default"
              }`}
            >
              <span
                className={`text-xs w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                  isToday ? "bg-blue-600 text-white font-bold" : "text-slate-400"
                }`}
              >
                {date.getDate()}
              </span>
              {dayPosts.map((p) => (
                <button
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); onClickPost && onClickPost(p); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded truncate w-full text-left leading-tight ${
                    STATUS_CLS[p.status] ?? "bg-slate-600 text-slate-200"
                  }`}
                  title={p.caption ?? p.format}
                >
                  {p.caption ? p.caption.slice(0, 22) : p.format}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
