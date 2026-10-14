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
      className={`p-2.5 sm:p-3 bg-teal-50/50 border border-teal-200/60 rounded-xl text-xs text-slate-700 flex items-start gap-2.5 ${className}`}
    >
      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="leading-relaxed font-medium">{reason}</span>
    </div>
  );
};
