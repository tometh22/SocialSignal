import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  showWordmark?: boolean;
  compact?: boolean;
};

export default function BrandMark({
  className,
  showWordmark = true,
  compact = false,
}: BrandMarkProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_30px_-18px_rgba(0,0,0,0.8)]",
          compact ? "h-8 w-8" : "h-9 w-9",
        )}
      >
        <svg viewBox="0 0 28 28" fill="none" className="h-[72%] w-[72%]" aria-hidden="true">
          <polyline
            points="4,24 4,7 14,17 24,7 24,24"
            stroke="white"
            strokeWidth="1.7"
            strokeOpacity="0.78"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {[["4", "24"], ["4", "7"], ["14", "17"], ["24", "7"], ["24", "24"]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="white" fillOpacity="0.92" />
          ))}
          <circle cx="20" cy="3.5" r="2.6" fill="#f43f5e" />
        </svg>
        <span className="absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-rose-400/80 to-transparent" />
      </div>

      {showWordmark && (
        <div className="min-w-0 leading-none">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold tracking-[-0.035em] text-white">mind</span>
            <span className="rounded-full border border-white/10 bg-white/[0.07] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
              OS
            </span>
          </div>
          <p className="mt-1 text-[9px] font-medium tracking-[0.06em] text-white/35">
            EPICAL INTELLIGENCE
          </p>
        </div>
      )}
    </div>
  );
}
