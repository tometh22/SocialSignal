import { cn } from "@/lib/utils";
import type { ReviewRoomMember } from "@/lib/review-api";

function initials(firstName: string | null, lastName: string | null): string {
  return `${(firstName ?? '?')[0]}${(lastName ?? '')[0]}`.toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-sky-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500',
];

export default function MemberAvatarsStack({ members, max = 4, onClick, showPlus = false, className }: {
  members: ReviewRoomMember[];
  max?: number;
  onClick?: () => void;
  showPlus?: boolean;
  className?: string;
}) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <button
      onClick={onClick}
      className={cn("flex items-center -space-x-1.5 hover:opacity-80 transition-opacity", className)}
      title={onClick ? "Ver miembros" : undefined}
      type="button"
    >
      {visible.map((m, i) => (
        <div
          key={m.userId}
          className={cn(
            "h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white shrink-0",
            AVATAR_COLORS[m.userId % AVATAR_COLORS.length],
          )}
          title={`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()}
        >
          {initials(m.firstName, m.lastName)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-600 shrink-0">
          +{overflow}
        </div>
      )}
      {showPlus && (
        <div className="h-6 w-6 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          +
        </div>
      )}
    </button>
  );
}
