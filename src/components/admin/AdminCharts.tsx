import type { CategoryValue, TrendPoint } from '../../types/admin';
import { Panel } from './AdminPrimitives';

const max = (items: TrendPoint[]) => Math.max(...items.map((item) => item.value), 1);

export const TrendChart = ({ title, description, data, suffix = '' }: { title: string; description?: string; data: TrendPoint[]; suffix?: string }) => {
  const highest = max(data);
  return <Panel title={title} description={description}>
    {data.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No data available for the selected period.</div> : <div className="px-4 py-5 sm:px-5">
      <div className="flex h-48 items-end gap-1 overflow-hidden border-b border-l border-slate-200 pl-3 sm:gap-2">
        {data.map((point) => <div key={point.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
          <div className="relative w-full rounded-t-sm bg-slate-800 transition-opacity group-hover:opacity-80" style={{ height: Math.max((point.value / highest) * 100, 4) + '%' }} title={point.label + ': ' + point.value + suffix} />
        </div>)}
      </div>
      <div className="mt-2 flex gap-1 overflow-hidden pl-3 sm:gap-2">
        {data.map((point, index) => <span key={point.label} className="min-w-0 flex-1 truncate text-center text-[9px] text-slate-400" title={point.label}>{data.length > 14 ? (index % 7 === 0 ? point.label : '') : point.label}</span>)}
      </div>
    </div>}
  </Panel>;
};

export const CategoryChart = ({ data, title = 'Breakdown', description = 'Recorded values in the selected reporting range.' }: { data: CategoryValue[]; title?: string; description?: string }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const highest = Math.max(...data.map((item) => item.value), 1);
  return <Panel title={title} description={description}>
    {data.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No data available for the selected period.</div> : <div className="p-4 sm:p-5">
      <div className="space-y-3">
        {data.map((item) => <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs"><span className="min-w-0 truncate text-slate-600" title={item.label}>{item.label}</span><span className="font-semibold text-slate-900">{item.value}{total > 0 ? ' · ' + Math.round((item.value / total) * 100) + '%' : ''}</span></div>
          <div className="h-2 overflow-hidden rounded-sm bg-slate-100"><div className="h-full bg-slate-700" style={{ width: (item.value / highest) * 100 + '%' }} /></div>
        </div>)}
      </div>
    </div>}
  </Panel>;
};
