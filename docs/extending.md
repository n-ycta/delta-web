# Расширение консоли

## Манифест плагина

Минимальный манифест (полная схема — `src/core/contracts/plugin.ts`, песочница — раздел «Контракты»):

```json
{
  "id": "dev.me.pomodoro",
  "name": "Помидоры",
  "version": "0.1.0",
  "contract": "^1.4.0",
  "publisher": "me",
  "description": "Фокус-сессии",
  "runtime": { "targets": ["desktop"] },
  "metrics": [{
    "id": "focus", "label": "Фокус", "kind": "duration", "unit": "s",
    "aggregations": ["sum"],
    "dimensions": [{ "id": "project", "label": "Проект", "values": [{ "id": "a", "label": "Работа" }] }],
    "visualizations": ["bar", "timeseries"]
  }],
  "settings": [{ "key": "length", "label": "Длина сессии", "type": "number", "default": 25, "unit": "мин" }]
}
```

- `kind`: `gauge | counter | ratio | duration | distribution | categorical | event` — определяет, какие виджеты подходят.
- `visualizations` — подсказки, а не требования. Неизвестные значения допускаются и отображаются в отчёте.
- `contract` — semver-диапазон версии контракта панели. Несовпадение мажорной версии блокирует установку.
- `settings` — консоль строит форму сама: `string | secret | number | boolean | select | multiselect`.
- `permissions` — области данных, которые пользователь подтверждает при установке; `required: false` можно снять.

## Новый тип виджета

```ts
// src/widgets/registry.ts
widgetRegistry.register({
  type: 'sankey', version: '1.0.0', label: 'Потоки', icon: 'waypoints', category: 'metric',
  description: 'Потоки между категориями', aliases: ['flow'],
  // score 0 = не подходит; reason показывается в редакторе виджета
  accepts: (m) => (m.kind === 'categorical' && m.dimensions.length >= 2 ? { score: 70 } : { score: 0, reason: 'нужно ≥2 измерения' }),
  defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
  options: ['legend', 'palette'],
  component: SankeyWidget,      // получает { config, ctx } — см. src/widgets/types.ts
  migrate: (cfg, from) => cfg,  // вызывается для конфигов с меньшей мажорной версией
});
```

После регистрации тип автоматически:
- участвует в ранжировании для метрик и появляется в редакторе виджета;
- считается «известной визуализацией» при валидации манифестов (`geo-map` перестанет быть предупреждением, если зарегистрировать его);
- получает обработку версий: конфиг новее мажорной версии → «несовместим», старее и есть `migrate` → «мигрирован».

Данные виджет получает через `<MetricData cfg ctx>` (`src/widgets/shared.tsx`) — загрузка, ошибки, пустые состояния и повтор уже обработаны.

## Новый адаптер ядра

Реализуйте `CoreApi` (`src/api/types.ts`) и верните его из `createCoreApi`. UI не нужно менять.
