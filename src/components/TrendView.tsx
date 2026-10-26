import { lazy, Suspense } from 'react';
import type { Snapshot } from '../../shared/types.ts';

const TrendCanvas = lazy(() => import('./TrendCanvas.tsx'));

export function TrendView(props: {
  snapshot: Snapshot;
  onAdd: () => void;
  onHistory: () => void;
  onInsights: () => void;
  onSettings: () => void;
}) {
  return <div className="trend-page"><Suspense fallback={<div className="canvas-loading" role="status">正在载入趋势…</div>}><TrendCanvas {...props}/></Suspense></div>;
}
