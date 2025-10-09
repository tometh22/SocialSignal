// 🛡️ Consistency Watchdog - Detecta inconsistencias entre vistas (DEV only)

type ViewModel = {
  costDisplay?: number;
  revenueDisplay?: number;
  currencyNative?: 'ARS' | 'USD';
  budgetUtilization?: number;
  efficiency?: number;
};

export function assertConsistency({
  source,
  projectId,
  listVM,
  detailVM
}: {
  source: 'list' | 'detail';
  projectId: string | number;
  listVM?: ViewModel;
  detailVM?: ViewModel;
}) {
  // Solo en desarrollo
  if (import.meta.env.MODE === 'production') return;
  
  if (!listVM || !detailVM) return;
  
  const keys: (keyof ViewModel)[] = [
    'costDisplay',
    'revenueDisplay',
    'currencyNative',
    'budgetUtilization',
    'efficiency'
  ];
  
  const diffs: Record<string, { list: any; detail: any }> = {};
  
  for (const k of keys) {
    if (listVM[k] !== detailVM[k]) {
      diffs[k as string] = { list: listVM[k], detail: detailVM[k] };
    }
  }
  
  if (Object.keys(diffs).length) {
    console.groupCollapsed(`🚨 [CONSISTENCY] project ${projectId} mismatch (${source})`);
    console.table(diffs);
    console.log('List VM:', listVM);
    console.log('Detail VM:', detailVM);
    console.groupEnd();
  }
}

// 🛡️ Detecta cuando summary desaparece entre actualizaciones
export function watchSummaryDropped(prev: any, next: any, tag: string) {
  // Solo en desarrollo
  if (import.meta.env.MODE === 'production') return;
  
  if (prev?.summary?.costDisplay != null && next?.summary?.costDisplay == null) {
    console.error(`🚨 [INVARIANT] summary.costDisplay dropped by: ${tag}`);
    console.log('Previous summary:', prev.summary);
    console.log('Next summary:', next.summary);
  }
}
