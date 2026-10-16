import { resolve, dirname } from 'node:path';
import { Updater, UpdateError, errorCode } from './updater.mjs';
import { DeltaError } from './delta-sdk.mjs';
export const updateMessages = {
  remote_setup_failed: [
    'The target updater did not start. Check the Node runtime and network on that node.',
    'Установщик целевого узла не запустился. Проверьте Node и сеть на этом узле.',
  ],
  remote_update_unknown: [
    'Connection timed out. The target update may still be running; check its status before retrying.',
    'Связь не восстановилась вовремя. Обновление на целевом узле может продолжаться; проверьте состояние перед повтором.',
  ],
  autoRemote: [
    'Include remote cores in automatic installation',
    'Автоматически обновлять удалённые ядра',
  ],
  autoRemoteHelp: [
    'Separate opt-in for trusted remote nodes. Manual remote updates remain available.',
    'Отдельное согласие для доверенных удалённых узлов. Ручное удалённое обновление доступно независимо.',
  ],
  preparing: ['Preparing target node', 'Подготовка целевого узла'],
  remote_core: [
    'Update this core from its own node profile. Remote core binary replacement is not supported.',
    'Обновите это ядро из его собственного профиля узла. Удалённая замена бинарного файла не поддерживается.',
  ],
  node_offline: [
    'Node is offline. Last known installation data is shown.',
    'Узел недоступен. Показаны последние известные данные об установках.',
  ],
  version_unknown: ['Installed version is unknown', 'Установленная версия неизвестна'],
  unmanaged_plugin: [
    'Registered plugin is not managed by this node supervisor.',
    'Зарегистрированный плагин не управляется супервизором этого узла.',
  ],
  not_in_catalog: [
    'No official catalog entry for this installed plugin.',
    'Для установленного плагина нет записи в официальном каталоге.',
  ],
  release_unavailable: [
    'Release information is temporarily unavailable.',
    'Информация о релизах временно недоступна.',
  ],
  node_changed: [
    'Node identity changed. Check the connection and retry.',
    'Идентификатор узла изменился. Проверьте подключение и повторите.',
  ],
  unavailable: ['Unavailable', 'Недоступно'],
  unknown: ['Unknown', 'Неизвестно'],
  forbidden: [
    'Only the node owner can manage updates.',
    'Только владелец узла может управлять обновлениями.',
  ],
  invalid_settings: [
    'Choose an interval of 15–1440 minutes. Automatic installation requires automatic checks.',
    'Выберите интервал 15–1440 минут. Для автоустановки нужна автопроверка.',
  ],
  busy: ['An update is already running.', 'Обновление уже выполняется.'],
  another_install: [
    'Another plugin installation is in progress. Retry afterwards.',
    'Другой плагин уже устанавливается. Повторите после завершения.',
  ],
  nothing_to_update: [
    'No newer stable versions are available for this selection.',
    'Для выбранных компонентов нет новых стабильных версий.',
  ],
  core_first: [
    'Update the core first to preserve disabled plugins and verify checked package versions.',
    'Сначала обновите ядро: это необходимо для сохранения отключённых плагинов и проверки выбранных версий.',
  ],
  independent_worker: [
    'Cannot start an independent update worker. The running service has not been stopped.',
    'Не удалось запустить независимый установщик. Работающая служба не остановлена.',
  ],
  managed_install_required: [
    'The core is not installed in the managed node profile. Source/system binaries are not replaced.',
    'Ядро не установлено в управляемом профиле узла. Бинарные файлы из исходников или системных пакетов не заменяются.',
  ],
  operation_failed: [
    'Update failed. Check the update status and retry.',
    'Не удалось выполнить обновление. Проверьте его состояние и повторите.',
  ],
  invalid_target: ['Unknown update target.', 'Неизвестный компонент обновления.'],
};
export async function createUpdateService() {
  const home =
    process.env.DELTA_HOME ||
    (process.env.DELTA_DATA ? resolve(dirname(process.env.DELTA_DATA), '..') : null);
  if (!home) throw new UpdateError('home_required');
  return new Updater(home).init();
}
export function updateHandlers(updater) {
  const wrap =
    (fn) =>
    async (a = {}, c) => {
      if (!c?.scopes?.includes('admin'))
        throw new DeltaError('forbidden', updateMessages.forbidden[a._locale === 'ru' ? 1 : 0]);
      try {
        return await fn(a);
      } catch (e) {
        const code = errorCode(e),
          message = (updateMessages[code] || updateMessages.operation_failed)[
            a._locale === 'ru' ? 1 : 0
          ];
        throw new DeltaError(
          ['forbidden'].includes(code)
            ? 'forbidden'
            : ['busy', 'another_install'].includes(code)
              ? 'conflict'
              : 'bad_request',
          message,
        );
      }
    };
  return {
    'web.updates_status': wrap(() => updater.status()),
    'web.updates_check': wrap(() => updater.check()),
    'web.updates_settings': wrap((a) => updater.settings(a.values)),
    'web.updates_install': wrap((a) => updater.apply(a.target || 'all')),
  };
}
