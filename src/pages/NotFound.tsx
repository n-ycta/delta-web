import { tr } from '@/i18n';
import { Link, useLocation } from 'react-router-dom';
import { Empty } from '@/ui/states';
import { Icon } from '@/ui/Icon';

export function NotFound() {
  const loc = useLocation();
  return (
    <div className="page">
      <div className="panel">
        <Empty icon={<Icon name="compass" size={18} />} title={tr("pages.NotFound.s_e662af0dca")} action={<Link className="btn primary" to="/">{tr("pages.NotFound.s_ef1ad90b17")}</Link>}>
          {tr("pages.NotFound.s_1ccf2bb200")}<code>{loc.pathname}</code> {tr("pages.NotFound.s_d24272bd51")}</Empty>
      </div>
    </div>
  );
}
