import { createContext, useContext, type ReactNode } from 'react';
import type { CoreApi } from '@/api';

const Ctx = createContext<CoreApi | null>(null);
export function ApiProvider({ api, children }: { api: CoreApi; children: ReactNode }) { return <Ctx.Provider value={api}>{children}</Ctx.Provider>; }
export function useApi(): CoreApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useApi outside ApiProvider');
  return api;
}
