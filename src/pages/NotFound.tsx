import { Link, useLocation } from 'react-router-dom';
import { Empty } from '@/ui/states';
import { Icon } from '@/ui/Icon';

export function NotFound() {
  const loc = useLocation();
  return (
    <div className="page">
      <div className="panel">
        <Empty icon={<Icon name="compass" size={18} />} title="Раздел не найден" action={<Link className="btn primary" to="/">На главную</Link>}>
          Адрес <code>{loc.pathname}</code> не соответствует ни одному разделу консоли. Возможно, плагин, который его добавлял, был удалён.
        </Empty>
      </div>
    </div>
  );
}
