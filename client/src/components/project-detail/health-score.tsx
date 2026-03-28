/**
 * Health Score — composite project health gauge (0–100)
 * Factors: markup (40pts), budget utilization (35pts), hours deviation (25pts)
 */

// ─── Score computation (exported for use in hero) ─────────────────────────────

export interface HealthInput {
  markup: number;
  budgetUtilization: number; // 0-100, 0 if no budget set
  hoursDeviation: number;    // % over estimate, 0 if no estimate
  hasBudget: boolean;
  hasHoursEstimate: boolean;
}

export function computeHealthScore(h: HealthInput): number {
  const { markup, budgetUtilization, hoursDeviation, hasBudget, hasHoursEstimate } = h;

  // Dynamic weights based on available data
  const wMarkup  = hasBudget && hasHoursEstimate ? 40 : hasBudget || hasHoursEstimate ? 55 : 100;
  const wBudget  = hasBudget ? (hasHoursEstimate ? 35 : 45) : 0;
  const wHours   = hasHoursEstimate ? (hasBudget ? 25 : 45) : 0;

  // Markup score
  let markupScore = 0;
  if      (markup >= 3.5) markupScore = wMarkup;
  else if (markup >= 3.0) markupScore = wMarkup * 0.92;
  else if (markup >= 2.5) markupScore = wMarkup * 0.80;
  else if (markup >= 2.0) markupScore = wMarkup * 0.52;
  else if (markup >= 1.5) markupScore = wMarkup * 0.25;
  else                    markupScore = 0;

  // Budget score
  let budgetScore = 0;
  if (hasBudget) {
    if      (budgetUtilization <= 50)  budgetScore = wBudget;
    else if (budgetUtilization <= 65)  budgetScore = wBudget * 0.88;
    else if (budgetUtilization <= 75)  budgetScore = wBudget * 0.70;
    else if (budgetUtilization <= 85)  budgetScore = wBudget * 0.45;
    else if (budgetUtilization <= 95)  budgetScore = wBudget * 0.15;
    else                               budgetScore = 0;
  }

  // Hours deviation score
  let hoursScore = 0;
  if (hasHoursEstimate) {
    if      (hoursDeviation <= 5)   hoursScore = wHours;
    else if (hoursDeviation <= 15)  hoursScore = wHours * 0.82;
    else if (hoursDeviation <= 25)  hoursScore = wHours * 0.58;
    else if (hoursDeviation <= 40)  hoursScore = wHours * 0.30;
    else if (hoursDeviation <= 60)  hoursScore = wHours * 0.10;
    else                            hoursScore = 0;
  }

  return Math.round(markupScore + budgetScore + hoursScore);
}

export function healthGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

export function healthLabel(score: number) {
  if (score >= 85) return { text: "Excelente",    color: "text-emerald-600", bg: "bg-emerald-500", ring: "ring-emerald-200" };
  if (score >= 70) return { text: "Saludable",    color: "text-emerald-600", bg: "bg-emerald-400", ring: "ring-emerald-200" };
  if (score >= 50) return { text: "Aceptable",    color: "text-amber-600",   bg: "bg-amber-400",   ring: "ring-amber-200"   };
  if (score >= 30) return { text: "En Riesgo",    color: "text-orange-600",  bg: "bg-orange-500",  ring: "ring-orange-200"  };
  return                   { text: "Crítico",      color: "text-red-600",     bg: "bg-red-500",     ring: "ring-red-200"     };
}

// ─── Visual Component ─────────────────────────────────────────────────────────

interface HealthScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export default function HealthScore({ score, size = "md" }: HealthScoreProps) {
  const grade = healthGrade(score);
  const info  = healthLabel(score);

  const dim = size === "sm" ? 64 : size === "lg" ? 120 : 88;
  const strokeW = size === "sm" ? 6 : 8;
  const r = (dim / 2) - strokeW;
  const circumference = 2 * Math.PI * r;
  // Arc goes from -225deg to 45deg (270deg sweep = 75% of circle)
  const arcFraction = 0.75;
  const filled = arcFraction * (score / 100) * circumference;
  const gap    = circumference - filled;

  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-4xl" : "text-2xl";
  const gradeSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ transform: "rotate(-225deg)" }}>
          {/* Track */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeW}
            strokeDasharray={`${arcFraction * circumference} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke={
              score >= 70 ? "#10b981"
              : score >= 50 ? "#f59e0b"
              : score >= 30 ? "#f97316"
              : "#ef4444"
            }
            strokeWidth={strokeW}
            strokeDasharray={`${filled} ${gap + circumference * (1 - arcFraction)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${textSize} font-bold text-slate-900 leading-none tabular-nums`}>{score}</span>
          <span className={`${gradeSize} font-bold ${info.color} leading-none`}>{grade}</span>
        </div>
      </div>
      <span className={`text-xs font-semibold ${info.color}`}>{info.text}</span>
    </div>
  );
}
