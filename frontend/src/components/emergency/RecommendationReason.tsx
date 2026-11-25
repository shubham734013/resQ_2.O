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
      className={`p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-200 flex items-start gap-2.5 backdrop-blur-md ${className}`}
    >
      <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="leading-relaxed font-medium">{reason}</span>
    </div>
  );
};
