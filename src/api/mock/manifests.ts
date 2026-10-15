import type { PluginManifestInput } from '@/core/contracts';

/**
 * Demo plugin manifests, as a real core would serve them.
 * Some are deliberately imperfect to exercise validation & compatibility paths.
 */
const LANG = { id: 'language', label: 'Язык', values: [{ id: 'ru', label: 'Русский' }, { id: 'en', label: 'English' }] };

export const typing: PluginManifestInput = {
  id: 'dev.delta.typing',
  name: 'Анализ печати',
  version: '2.4.1',
  contract: '^1.2.0',
  publisher: 'delta-core',
  description: 'Скорость и точность набора по языкам, раскладкам и приложениям. Считает только агрегаты — сами нажатия не сохраняются.',
  icon: 'keyboard',
  category: 'input',
  capabilities: ['metrics.timeseries', 'metrics.realtime', 'settings.live', 'export.csv', 'actions'],
  runtime: { targets: ['desktop', 'android'], minAgent: '1.6.0' },
  permissions: [
    { scope: 'input.keyboard.stats', reason: 'Агрегированная статистика нажатий без содержимого' },
    { scope: 'apps.foreground.read', reason: 'Разбивка скорости по активному приложению', optional: true },
  ],
  settings: [
    { key: 'languages', type: 'multiselect', label: 'Отслеживаемые языки', default: ['ru', 'en'], options: [{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }] },
    { key: 'minSession', type: 'number', label: 'Минимальная сессия', default: 30, min: 5, max: 600, unit: 'с', help: 'Короткие всплески набора не учитываются' },
    { key: 'excludeApps', type: 'string', label: 'Исключить приложения', default: 'keepassxc, 1password', placeholder: 'через запятую', group: 'Приватность' },
    { key: 'pauseOnPassword', type: 'boolean', label: 'Пауза в полях пароля', default: true, group: 'Приватность' },
    { key: 'sampling', type: 'select', label: 'Частота выгрузки', default: '60', options: [{ value: '15', label: '15 с' }, { value: '60', label: '1 мин' }, { value: '300', label: '5 мин' }], requiresRestart: true },
  ],
  metrics: [
    { id: 'wpm', label: 'Скорость набора', description: 'Слов в минуту в активных сессиях', kind: 'gauge', unit: 'wpm', precision: 0, better: 'higher', dimensions: [LANG], aggregations: ['avg', 'max', 'p95'], defaultAggregation: 'avg', visualizations: ['timeseries', 'comparison', 'stat'] },
    { id: 'accuracy', label: 'Точность', description: 'Доля символов без исправления', kind: 'ratio', unit: 'ratio', precision: 1, better: 'higher', range: { min: 0, max: 1 }, dimensions: [LANG], aggregations: ['avg', 'min'], visualizations: ['gauge', 'timeseries'], thresholds: [{ value: 0.9, severity: 'warn', label: 'Ниже 90%' }] },
    { id: 'keystrokes', label: 'Нажатия', kind: 'counter', unit: '', precision: 0, dimensions: [LANG], aggregations: ['sum'], visualizations: ['bar', 'heatmap', 'stat'] },
    { id: 'error_keys', label: 'Клавиши с ошибками', kind: 'categorical', unit: '', precision: 0, dimensions: [{ id: 'key', label: 'Клавиша' }], aggregations: ['sum'], visualizations: ['breakdown'] },
    { id: 'key_latency', label: 'Интервал между нажатиями', kind: 'distribution', unit: 'ms', precision: 0, better: 'lower', aggregations: ['avg', 'p95'], visualizations: ['distribution'] },
    { id: 'session_time', label: 'Время набора', kind: 'duration', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'app', label: 'Приложение', values: [{ id: 'code', label: 'VS Code' }, { id: 'tg', label: 'Telegram' }, { id: 'browser', label: 'Браузер' }, { id: 'obsidian', label: 'Obsidian' }] }], visualizations: ['bar', 'breakdown'] },
  ],
  actions: [
    { id: 'recalibrate', label: 'Пересчитать базовую скорость', description: 'Сбросить персональную норму и пересчитать за 30 дней' },
    { id: 'purge-today', label: 'Удалить данные за сегодня', dangerous: true },
  ],
  changelog: [
    { version: '2.4.1', date: '2026-09-28', notes: ['Исправлен подсчёт в Wayland-сессиях'] },
    { version: '2.4.0', date: '2026-09-10', notes: ['Метрика интервала между нажатиями', 'Разбивка по приложениям'] },
  ],
};

export const typingLatest: PluginManifestInput = {
  ...typing,
  version: '2.5.0',
  changelog: [{ version: '2.5.0', date: '2026-10-11', notes: ['Поддержка раскладки Colemak', 'Ускорена выгрузка буфера на Android', 'Новая метрика: переключения раскладки'] }, ...(typing.changelog ?? [])],
  metrics: [...(typing.metrics ?? []), { id: 'layout_switches', label: 'Переключения раскладки', kind: 'counter', unit: '', precision: 0, aggregations: ['sum'], visualizations: ['bar'] }],
};

export const health: PluginManifestInput = {
  id: 'dev.delta.health',
  name: 'Сон и активность',
  version: '1.9.0',
  contract: '^1.3.0',
  publisher: 'delta-core',
  description: 'Шаги, пульс и фазы сна из Health Connect и носимых устройств.',
  icon: 'heart-pulse',
  category: 'health',
  capabilities: ['metrics.timeseries', 'storage.local'],
  runtime: { targets: ['android'] },
  permissions: [
    { scope: 'health.steps.read', reason: 'Количество шагов' },
    { scope: 'health.heart.read', reason: 'Пульс и вариабельность' },
    { scope: 'health.sleep.read', reason: 'Фазы сна' },
  ],
  settings: [
    { key: 'stepGoal', type: 'number', label: 'Цель по шагам', default: 9000, min: 1000, max: 40000, step: 500 },
    { key: 'source', type: 'select', label: 'Источник', default: 'hc', options: [{ value: 'hc', label: 'Health Connect' }, { value: 'gf', label: 'Google Fit (устар.)' }] },
  ],
  metrics: [
    { id: 'steps', label: 'Шаги', kind: 'counter', unit: '', precision: 0, better: 'higher', aggregations: ['sum'], visualizations: ['bar', 'stat', 'heatmap'] },
    { id: 'heart_rate', label: 'Пульс', kind: 'gauge', unit: 'уд/мин', precision: 0, aggregations: ['avg', 'min', 'max'], visualizations: ['timeseries'], thresholds: [{ value: 120, severity: 'warn' }] },
    { id: 'sleep', label: 'Сон', kind: 'duration', unit: 's', better: 'higher', dimensions: [{ id: 'stage', label: 'Фаза', values: [{ id: 'deep', label: 'Глубокий' }, { id: 'light', label: 'Лёгкий' }, { id: 'rem', label: 'REM' }] }], aggregations: ['sum', 'avg'], visualizations: ['bar', 'breakdown'] },
    { id: 'hrv', label: 'Вариабельность пульса', kind: 'gauge', unit: 'мс', precision: 0, better: 'higher', aggregations: ['avg'], visualizations: ['timeseries', 'stat'] },
  ],
};

export const finance: PluginManifestInput = {
  id: 'dev.delta.finance',
  name: 'Финансы',
  version: '0.8.3',
  contract: '^1.0.0',
  publisher: 'delta-labs',
  description: 'Импорт выписок и уведомлений банков, категоризация трат, остатки по счетам.',
  icon: 'wallet',
  category: 'finance',
  capabilities: ['metrics.timeseries', 'events.stream', 'export.csv'],
  runtime: { targets: ['vps', 'android'] },
  permissions: [
    { scope: 'notifications.bank.read', reason: 'Разбор банковских push-уведомлений' },
    { scope: 'storage.encrypted.write', reason: 'Хранение транзакций в зашифрованном виде' },
  ],
  settings: [
    { key: 'currency', type: 'select', label: 'Базовая валюта', default: 'RUB', options: [{ value: 'RUB', label: '₽ RUB' }, { value: 'EUR', label: '€ EUR' }, { value: 'USD', label: '$ USD' }] },
    { key: 'budget', type: 'number', label: 'Месячный бюджет', default: 90000, min: 0, unit: '₽' },
    { key: 'imapPassword', type: 'secret', label: 'Пароль IMAP для выписок', group: 'Интеграции' },
  ],
  metrics: [
    { id: 'spend', label: 'Траты', kind: 'counter', unit: '₽', precision: 0, better: 'lower', dimensions: [{ id: 'category', label: 'Категория', values: [{ id: 'food', label: 'Продукты' }, { id: 'cafe', label: 'Кафе' }, { id: 'transport', label: 'Транспорт' }, { id: 'subs', label: 'Подписки' }, { id: 'home', label: 'Дом' }, { id: 'other', label: 'Прочее' }] }], aggregations: ['sum'], visualizations: ['bar', 'breakdown', 'stat'] },
    { id: 'balance', label: 'Остаток', kind: 'gauge', unit: '₽', precision: 0, aggregations: ['last', 'min'], defaultAggregation: 'last', visualizations: ['timeseries', 'stat'] },
  ],
};

export const git: PluginManifestInput = {
  id: 'dev.delta.git',
  name: 'Git-активность',
  version: '1.2.0',
  contract: '^1.1.0',
  publisher: 'delta-core',
  description: 'Коммиты, изменения и ревью по локальным репозиториям и Gitea/GitHub.',
  icon: 'git-branch',
  category: 'dev',
  capabilities: ['metrics.timeseries', 'events.stream'],
  runtime: { targets: ['desktop', 'vps'] },
  permissions: [{ scope: 'fs.repos.read', reason: 'Чтение истории git в указанных каталогах' }, { scope: 'net.github.read', reason: 'Статусы PR', optional: true }],
  settings: [
    { key: 'roots', type: 'string', label: 'Корневые каталоги', default: '~/src, ~/work' },
    { key: 'githubToken', type: 'secret', label: 'GitHub token' },
  ],
  metrics: [
    { id: 'commits', label: 'Коммиты', kind: 'counter', unit: '', precision: 0, dimensions: [{ id: 'repo', label: 'Репозиторий', values: [{ id: 'delta-core', label: 'delta-core' }, { id: 'console', label: 'console' }, { id: 'dotfiles', label: 'dotfiles' }] }], aggregations: ['sum'], visualizations: ['bar', 'heatmap'] },
    { id: 'churn', label: 'Изменённые строки', kind: 'counter', unit: 'строк', precision: 0, dimensions: [{ id: 'op', label: 'Тип', values: [{ id: 'add', label: 'Добавлено' }, { id: 'del', label: 'Удалено' }] }], aggregations: ['sum'], visualizations: ['bar'] },
  ],
};

export const home: PluginManifestInput = {
  id: 'dev.delta.home',
  name: 'Дом',
  version: '3.0.2',
  contract: '^1.4.0',
  publisher: 'delta-core',
  description: 'Датчики Zigbee/MQTT: климат, CO₂, энергопотребление по комнатам.',
  icon: 'house',
  category: 'home',
  capabilities: ['metrics.timeseries', 'metrics.realtime', 'actions', 'x-scenes'],
  runtime: { targets: ['sbc', 'vps'] },
  permissions: [{ scope: 'net.mqtt.subscribe', reason: 'Подписка на топики zigbee2mqtt' }, { scope: 'devices.*', reason: 'Управление сценами освещения' }],
  settings: [
    { key: 'broker', type: 'string', label: 'MQTT-брокер', default: 'mqtt://rpi-home.lan:1883' },
    { key: 'co2Alert', type: 'number', label: 'Порог CO₂', default: 1000, unit: 'ppm', min: 400, max: 5000 },
  ],
  metrics: [
    { id: 'temperature', label: 'Температура', kind: 'gauge', unit: '°C', precision: 1, dimensions: [{ id: 'room', label: 'Комната', values: [{ id: 'living', label: 'Гостиная' }, { id: 'bedroom', label: 'Спальня' }, { id: 'office', label: 'Кабинет' }] }], aggregations: ['avg', 'min', 'max', 'last'], visualizations: ['timeseries', 'comparison'] },
    { id: 'co2', label: 'CO₂', kind: 'gauge', unit: 'ppm', precision: 0, better: 'lower', range: { min: 400, max: 2000 }, dimensions: [{ id: 'room', label: 'Комната', values: [{ id: 'bedroom', label: 'Спальня' }, { id: 'office', label: 'Кабинет' }] }], aggregations: ['avg', 'max', 'last'], visualizations: ['timeseries', 'gauge'], thresholds: [{ value: 1000, severity: 'warn' }, { value: 1400, severity: 'error' }] },
    { id: 'energy', label: 'Электроэнергия', kind: 'counter', unit: 'кВт·ч', precision: 2, aggregations: ['sum'], visualizations: ['bar', 'heatmap'] },
  ],
  actions: [{ id: 'scene-night', label: 'Сцена «Ночь»' }, { id: 'reconnect', label: 'Переподключить брокер' }],
};

export const screen: PluginManifestInput = {
  id: 'dev.delta.screen',
  name: 'Экранное время',
  version: '1.1.4',
  contract: '^1.0.0',
  publisher: 'delta-core',
  description: 'Время в приложениях и разблокировки по всем устройствам.',
  icon: 'smartphone',
  category: 'productivity',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['android', 'desktop'] },
  permissions: [{ scope: 'apps.usage.read', reason: 'Статистика использования приложений' }],
  settings: [{ key: 'focusApps', type: 'string', label: 'Рабочие приложения', default: 'code, obsidian, terminal' }],
  metrics: [
    { id: 'screen_time', label: 'Экранное время', kind: 'duration', unit: 's', better: 'lower', dimensions: [{ id: 'device', label: 'Устройство', values: [{ id: 'pixel', label: 'Pixel 8' }, { id: 'ws', label: 'workstation' }, { id: 'mac', label: 'macbook-air' }] }], aggregations: ['sum'], visualizations: ['bar', 'stat'] },
    { id: 'top_apps', label: 'Топ приложений', kind: 'categorical', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'app', label: 'Приложение' }], visualizations: ['breakdown', 'pie'] },
    { id: 'pickups', label: 'Разблокировки', kind: 'counter', unit: '', precision: 0, better: 'lower', aggregations: ['sum'], visualizations: ['heatmap', 'stat'] },
  ],
};

export const browser: PluginManifestInput = {
  id: 'dev.delta.browser',
  name: 'История браузера',
  version: '0.6.0',
  contract: '^1.2.0',
  publisher: 'delta-labs',
  description: 'Домены и время чтения из Firefox Sync и Chromium-профилей.',
  icon: 'globe',
  category: 'productivity',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['vps', 'desktop'] },
  permissions: [{ scope: 'net.firefox.sync', reason: 'Получение истории через Firefox Sync' }],
  settings: [
    { key: 'syncAccount', type: 'string', label: 'Аккаунт Firefox', default: 'me@example.org' },
    { key: 'syncToken', type: 'secret', label: 'Токен синхронизации' },
  ],
  metrics: [
    { id: 'visits', label: 'Посещения', kind: 'counter', unit: '', precision: 0, aggregations: ['sum'], visualizations: ['bar'] },
    { id: 'domains', label: 'Домены', kind: 'categorical', unit: '', aggregations: ['sum'], dimensions: [{ id: 'domain', label: 'Домен' }], visualizations: ['breakdown'] },
  ],
};

// ---- registry-only (not installed) -------------------------------------------------

export const weather: PluginManifestInput = {
  id: 'dev.delta.weather',
  name: 'Метеостанция',
  version: '1.0.3',
  contract: '^1.2.0',
  publisher: 'delta-core',
  description: 'Уличная температура, давление и осадки — локальная станция или Open-Meteo.',
  icon: 'cloud-sun',
  category: 'home',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['vps', 'sbc'] },
  permissions: [{ scope: 'net.http.outbound', reason: 'Запросы к api.open-meteo.com' }],
  settings: [
    { key: 'lat', type: 'number', label: 'Широта', default: 56.84 },
    { key: 'lon', type: 'number', label: 'Долгота', default: 60.6 },
    { key: 'provider', type: 'select', label: 'Источник', default: 'open-meteo', options: [{ value: 'open-meteo', label: 'Open-Meteo' }, { value: 'local', label: 'Локальная станция' }] },
  ],
  metrics: [
    { id: 'outdoor_temp', label: 'Температура на улице', kind: 'gauge', unit: '°C', precision: 1, aggregations: ['avg', 'min', 'max'], visualizations: ['timeseries', 'stat'] },
    { id: 'pressure', label: 'Давление', kind: 'gauge', unit: 'гПа', precision: 0, aggregations: ['avg'], visualizations: ['timeseries'] },
    { id: 'precip', label: 'Осадки', kind: 'counter', unit: 'мм', precision: 1, aggregations: ['sum'], visualizations: ['bar'] },
  ],
};

export const music: PluginManifestInput = {
  id: 'org.community.scrobbler',
  name: 'Прослушивания',
  version: '0.4.0',
  contract: '^1.1.0',
  publisher: 'community / @lena',
  description: 'Скробблинг музыки из локальных плееров и стриминга, жанры и артисты.',
  icon: 'music',
  category: 'media',
  capabilities: ['metrics.timeseries', 'x-now-playing'],
  runtime: { targets: ['android', 'desktop'] },
  permissions: [{ scope: 'media.session.read', reason: 'Чтение текущего трека' }],
  settings: [{ key: 'minPlay', type: 'number', label: 'Минимум прослушивания', default: 30, unit: 'с' }],
  metrics: [
    { id: 'plays', label: 'Прослушивания', kind: 'counter', unit: '', precision: 0, aggregations: ['sum'], visualizations: ['bar', 'heatmap'] },
    { id: 'genres', label: 'Жанры', kind: 'categorical', unit: '', aggregations: ['sum'], dimensions: [{ id: 'genre', label: 'Жанр' }], visualizations: ['treemap', 'breakdown'] },
  ],
};

export const location: PluginManifestInput = {
  id: 'dev.delta.location',
  name: 'Геотрекер',
  version: '0.9.0',
  contract: '^1.3.0',
  publisher: 'delta-labs',
  description: 'Перемещения, посещённые места и время в пути. Использует визуализацию карты, которой пока нет в консоли.',
  icon: 'map-pin',
  category: 'location',
  capabilities: ['metrics.timeseries', 'x-geo-tiles', 'geo.tracks'],
  runtime: { targets: ['android'] },
  permissions: [{ scope: 'location.background', reason: 'Фоновая геолокация' }, { scope: 'location.history.read', reason: 'Импорт истории Google Maps', optional: true }],
  settings: [{ key: 'accuracy', type: 'select', label: 'Точность', default: 'balanced', options: [{ value: 'high', label: 'Высокая' }, { value: 'balanced', label: 'Сбалансированная' }, { value: 'low', label: 'Экономия' }] }],
  metrics: [
    { id: 'distance', label: 'Пройденное расстояние', kind: 'counter', unit: 'км', precision: 1, dimensions: [{ id: 'mode', label: 'Способ', values: [{ id: 'walk', label: 'Пешком' }, { id: 'transit', label: 'Транспорт' }, { id: 'car', label: 'Авто' }] }], aggregations: ['sum'], visualizations: ['geo-map', 'bar'] },
    { id: 'places', label: 'Места', kind: 'categorical', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'place', label: 'Место' }], visualizations: ['geo-heat', 'breakdown'] },
  ],
};

export const reader: PluginManifestInput = {
  id: 'io.readwise.bridge',
  name: 'Readwise Bridge',
  version: '3.1.0',
  contract: '^2.0.0',
  publisher: 'third-party',
  description: 'Хайлайты и время чтения. Собран под контракт 2.x, который эта версия консоли ещё не поддерживает.',
  icon: 'book-open',
  category: 'media',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['vps'] },
  permissions: [{ scope: 'net.readwise.read', reason: 'Доступ к API Readwise' }],
  metrics: [{ id: 'highlights', label: 'Хайлайты', kind: 'counter', unit: '', aggregations: ['sum'] }],
};

/** Deliberately broken manifest to show schema errors in the catalog. */
export const legacyNotes: unknown = {
  id: 'NotesSync',
  name: 'Notes Sync (legacy)',
  version: '1.0',
  contract: '^0.9',
  publisher: 'unknown',
  description: 'Старый плагин синхронизации заметок.',
  runtime: { targets: ['desktop', 'mainframe'] },
  metrics: [
    { id: 'notes', label: 'Заметки', kind: 'counter', aggregations: ['sum'] },
    { id: 'notes', label: 'Заметки (дубль)', kind: 'tally' },
  ],
};
