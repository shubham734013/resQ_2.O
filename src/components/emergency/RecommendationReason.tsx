import { CheckCircle2 } from 'lucide-react';

export interface RecommendationReasonProps {
  reason: string;
  className?: string;
}

export const RecommendationReason = ({
  reason,
  className = '',
}: RecommendationReasonProps) => {
  return (
    <div
      className={`p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700 flex items-start gap-2 ${className}`}
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="leading-relaxed">{reason}</span>
    </div>
  );
};
