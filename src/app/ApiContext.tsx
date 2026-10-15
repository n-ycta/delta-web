import { tr } from '@/i18n';
import { createContext, useContext, type ReactNode } from 'react';
import type { CoreApi } from '@/api';

const Ctx = createContext<CoreApi | null>(null);
export function ApiProvider({ api, children }: { api: CoreApi; children: ReactNode }) { return <Ctx.Provider value={api}>{children}</Ctx.Provider>; }
export function useApi(): CoreApi {
  const api = useContext(Ctx);
  if (!api) throw new Error(tr("app.ApiContext.s_b13bbd2305"));
  return api;
}
