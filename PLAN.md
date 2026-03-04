# GigaAgent Lite — План реализации

## Описание проекта

Браузерное приложение — универсальный LLM-агент с поддержкой нескольких провайдеров (GigaChat, OpenAI, Anthropic и др.). Работает полностью на клиенте (без backend), хостится на GitHub Pages. Реализует классический LLM-loop (ReAct-паттерн): агент в цикле либо вызывает инструменты, либо выдаёт финальный ответ пользователю.

Пользователь может:
- Переключаться между LLM-провайдерами на лету
- Добавлять свои кастомные инструменты (tools)
- Выполнять JavaScript-код, читать/писать файлы — всё в браузере

## Проблема

Нужен лёгкий агент, который:
- Не привязан к одной LLM — можно выбрать GigaChat, OpenAI, Anthropic
- Не требует backend — всё в браузере
- Даёт пользователю возможность добавлять свои тулы
- Работает как настоящий агент (LLM-loop), а не просто чат

---

## Стек технологий

| Компонент | Технология | Зачем |
|-----------|-----------|-------|
| Сборка | **Vite** | Быстрый бандлер, TypeScript из коробки |
| Язык | **TypeScript** | Типизация, автодополнение |
| LLM (GigaChat) | **langchain-gigachat** (`npm`) | LangChain-совместимая обёртка над GigaChat API, поддержка `bindTools()` |
| LLM (OpenAI) | **@langchain/openai** | ChatOpenAI с tool calling |
| LLM (Anthropic) | **@langchain/anthropic** | ChatAnthropic с tool calling |
| LLM (ядро) | **@langchain/core** | Базовые абстракции: BaseChatModel, messages, tools |
| Markdown | **marked** | Рендеринг markdown в ответах |
| Подсветка кода | **highlight.js** | Подсветка синтаксиса |
| Хостинг | **GitHub Pages** | Бесплатный статический хостинг |

### Почему LangChain.js?

LangChain.js — унифицирующий слой:
- Единый интерфейс `BaseChatModel` для всех провайдеров
- `.bindTools(tools)` работает одинаково для GigaChat, OpenAI, Anthropic
- Стандартный формат сообщений (`HumanMessage`, `AIMessage`, `ToolMessage`)
- Не нужен LangGraph — для классического LLM-loop достаточно простого `while` цикла

### Почему НЕ LangGraph?

LangGraph избыточен для нашей задачи. Классический LLM-loop — это просто:
```
while (true) {
  response = await model.invoke(messages)
  if (no tool calls) break  // финальный ответ
  results = await executeTool(tool_calls)
  messages.push(response, ...results)
}
```
Это 20 строк кода, не нужен фреймворк для графов.

---

## Архитектура

```
┌──────────────────────────────────────────────────────────┐
│                         Браузер                           │
│                                                           │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  UI чата  │──▶│  Agent Loop  │──▶│  LLM Provider    │ │
│  │          │◀──│  (while)     │◀──│  (LangChain.js)  │ │
│  └──────────┘   └──────┬───────┘   └──────────────────┘ │
│                         │                                 │
│          ┌──────────────┼──────────────┐                  │
│          ▼              ▼              ▼                   │
│   ┌───────────┐  ┌───────────┐  ┌──────────────┐         │
│   │ execute_js│  │ файлы     │  │ custom tools │         │
│   │ (sandbox) │  │ (FS API)  │  │ (от юзера)   │         │
│   └───────────┘  └───────────┘  └──────────────┘         │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Provider Switcher: GigaChat | OpenAI | Anthropic │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘

LLM Provider = langchain-gigachat / @langchain/openai / @langchain/anthropic
```

### LLM-Loop (классический агентный цикл)

```
Пользователь вводит сообщение
         │
         ▼
Формируем messages[]:
  - system prompt
  - история диалога
  - новое сообщение (HumanMessage)
         │
         ▼
model = выбранный провайдер.bindTools(registeredTools)
         │
         ▼
┌────────────────────────────────────┐
│         ЦИКЛ (макс. 15 итераций)  │
│                                    │
│  response = await model.invoke()   │
│         │                          │
│  tool_calls в ответе?              │
│    НЕТ ──▶ break, показать текст  │
│    ДА  ──▶ выполнить каждый tool  │
│            добавить ToolMessage    │
│            ──▶ следующая итерация  │
└────────────────────────────────────┘
         │
         ▼
Показать финальный ответ пользователю
```

**Ключевое отличие от старого плана:** OpenAI/Anthropic могут вызывать несколько tool calls за один запрос (parallel tool calling). GigaChat — только один. Цикл обрабатывает оба случая.

---

## Мульти-провайдер

### Поддерживаемые провайдеры

| Провайдер | Пакет | Класс | Нужно от пользователя |
|-----------|-------|-------|-----------------------|
| GigaChat | `langchain-gigachat` | `GigaChat` | Authorization Key, Scope, Model |
| OpenAI | `@langchain/openai` | `ChatOpenAI` | API Key, Model (gpt-4o и др.) |
| Anthropic | `@langchain/anthropic` | `ChatAnthropic` | API Key, Model (claude-sonnet и др.) |

### Переключение провайдеров

В UI — выпадающий список (select) в хедере. При переключении:
1. Показываем форму настроек для выбранного провайдера
2. Сохраняем credentials в `localStorage` (отдельно для каждого провайдера)
3. Пересоздаём экземпляр модели через соответствующий LangChain-класс
4. История диалога сохраняется (формат сообщений единый благодаря LangChain)

### Фабрика моделей

```typescript
function createModel(provider: string, config: ProviderConfig): BaseChatModel {
  switch (provider) {
    case 'gigachat':
      return new GigaChat({
        credentials: config.credentials,
        scope: config.scope,
        model: config.model,
        // dangerouslyAllowBrowser / httpsAgent — нужна адаптация для браузера
      });
    case 'openai':
      return new ChatOpenAI({
        openAIApiKey: config.apiKey,
        modelName: config.model,
        // OpenAI работает из браузера напрямую (CORS разрешён)
      });
    case 'anthropic':
      return new ChatAnthropic({
        anthropicApiKey: config.apiKey,
        modelName: config.model,
        // Anthropic тоже работает из браузера
      });
  }
}
```

---

## Инструменты (Tools)

### Встроенные инструменты

Те же 4, что и раньше, но оформлены как LangChain tools (через `@tool` / `DynamicTool`):

#### 1. `execute_js` — Выполнение JavaScript кода
- Код запускается в sandboxed `<iframe>`
- Нет доступа к DOM, localStorage, cookies основной страницы
- Таймаут 10 секунд
- Перехват `console.log` + return value

#### 2. `read_file` — Чтение файла
- File System Access API
- Только внутри выбранной директории
- Chrome/Edge only

#### 3. `write_file` — Запись файла
- Подтверждение перед записью
- Только внутри выбранной директории

#### 4. `list_directory` — Список файлов
- Рекурсивно до 3 уровней
- Текстовое дерево

### Кастомные инструменты пользователя

Пользователь может добавить свои тулы через UI:

**Интерфейс добавления тула:**
- Имя (name)
- Описание (description) — для LLM, чтобы понимать когда вызывать
- Параметры (JSON Schema) — описание входных данных
- Код функции (JavaScript) — тело, которое выполняется при вызове

**Хранение:** `localStorage` (сериализованные определения)

**Как работает:**
1. Пользователь заполняет форму: имя, описание, параметры, код
2. Создаётся `DynamicTool` из `@langchain/core/tools`
3. Тул добавляется в реестр и передаётся модели через `.bindTools()`
4. Код кастомного тула выполняется в том же sandboxed iframe что и `execute_js`

**Пример кастомного тула:**
```
Имя: get_weather
Описание: Получить погоду в городе
Параметры: { "city": { "type": "string", "description": "Название города" } }
Код:
  const response = await fetch(`https://wttr.in/${args.city}?format=j1`);
  const data = await response.json();
  return `Температура: ${data.current_condition[0].temp_C}°C`;
```

---

## Авторизация

### Мульти-провайдерная форма

При выборе провайдера показываются соответствующие поля:

**GigaChat:**
| Поле | Описание |
|------|----------|
| Authorization Key | Ключ из GigaChat Studio |
| Scope | `GIGACHAT_API_PERS` / `GIGACHAT_API_B2B` / `GIGACHAT_API_CORP` |
| Модель | `GigaChat` / `GigaChat-2-Max` / `GigaChat-2-Pro` |
| CORS Proxy URL | Опционально, если API блокирует браузерные запросы |

**OpenAI:**
| Поле | Описание |
|------|----------|
| API Key | Ключ из OpenAI Dashboard |
| Модель | `gpt-4o` / `gpt-4o-mini` / `gpt-4-turbo` и др. |

**Anthropic:**
| Поле | Описание |
|------|----------|
| API Key | Ключ из Anthropic Console |
| Модель | `claude-sonnet-4-20250514` / `claude-haiku-4-5-20251001` и др. |

### Хранение

- `localStorage` с namespace по провайдеру: `agent_creds_gigachat`, `agent_creds_openai` и т.д.
- Последний выбранный провайдер тоже сохраняется

---

## CORS

| Провайдер | CORS в браузере |
|-----------|----------------|
| OpenAI | Работает (CORS разрешён) |
| Anthropic | Работает (CORS разрешён, нужен `anthropic-dangerous-direct-browser-access` header) |
| GigaChat | Вероятно НЕ работает — нужен CORS proxy |

**Решение для GigaChat:**
- Поле "CORS Proxy URL" в настройках
- По умолчанию пустое (пробуем напрямую)
- При ошибке CORS — показываем сообщение с инструкцией
- Формат проксирования: `{proxyUrl}/{originalUrl}`

---

## Структура файлов проекта

```
giga_agent_lite/
├── index.html                  # Точка входа HTML
├── package.json                # Зависимости и скрипты
├── tsconfig.json               # Настройки TypeScript
├── vite.config.ts              # Настройки Vite
├── PLAN.md                     # Этот файл
├── AGENTS.md                   # Описание концепции агентов
│
├── src/
│   ├── main.ts                 # Entry point: инициализация, роутинг UI
│   ├── styles.css              # Все стили
│   │
│   ├── providers/
│   │   ├── index.ts            # Фабрика моделей + типы ProviderConfig
│   │   │   - createModel(provider, config) → BaseChatModel
│   │   │   - getProviderFields(provider) → FormField[]
│   │   │   - PROVIDERS: Record<string, ProviderInfo>
│   │   │
│   │   ├── gigachat.ts         # Адаптер GigaChat для браузера
│   │   │   - создание GigaChat с CORS proxy
│   │   │   - обработка специфики (1 tool call за раз)
│   │   │
│   │   ├── openai.ts           # Обёртка для ChatOpenAI
│   │   └── anthropic.ts        # Обёртка для ChatAnthropic
│   │
│   ├── agent.ts                # LLM-Loop
│   │   - runAgentLoop(message, history, model, tools) → AsyncGenerator
│   │   - system prompt
│   │   - цикл: invoke → tool calls → execute → repeat
│   │   - yield на каждом шаге (для стриминга UI)
│   │
│   ├── tools/
│   │   ├── registry.ts         # Реестр инструментов
│   │   │   - registerTool(tool) / unregisterTool(name)
│   │   │   - getTools() → StructuredTool[]
│   │   │   - loadCustomTools() / saveCustomTools()
│   │   │
│   │   ├── builtin/
│   │   │   ├── execute-js.ts   # Песочница JS (sandboxed iframe)
│   │   │   └── file-system.ts  # read_file, write_file, list_directory
│   │   │
│   │   └── custom.ts           # Создание DynamicTool из пользовательского кода
│   │       - createCustomTool(name, description, schema, code) → DynamicTool
│   │       - валидация кода перед созданием
│   │
│   └── ui/
│       ├── chat.ts             # Рендеринг чата
│       │   - appendMessage(role, content)
│       │   - appendToolCall(name, args, result)
│       │   - renderMarkdown(text) → html
│       │
│       ├── settings.ts         # Настройки провайдера (вместо auth.ts)
│       │   - showSettings(provider)
│       │   - динамические поля в зависимости от провайдера
│       │   - saveProviderConfig() / loadProviderConfig()
│       │
│       ├── provider-switcher.ts # Переключатель провайдеров в хедере
│       │   - renderSwitcher()
│       │   - onProviderChange(callback)
│       │
│       ├── tool-editor.ts      # Редактор кастомных тулов
│       │   - showToolEditor()
│       │   - addTool() / editTool() / removeTool()
│       │   - список текущих тулов
│       │
│       └── file-picker.ts      # UI выбора директории
│           - showDirectoryPicker()
│           - getDirectoryHandle()
```

---

## План реализации (пошаговый)

### Этап 1: Каркас проекта
1. `package.json` с зависимостями: `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `langchain-gigachat`, `marked`, `highlight.js`
2. `tsconfig.json`, `vite.config.ts`
3. `index.html` с базовой разметкой (хедер с селектором провайдера, чат, инпут)
4. `src/main.ts` — entry point
5. `src/styles.css` — базовые стили
6. Проверить: `npm install && npm run dev`

### Этап 2: Провайдеры и настройки
1. `src/providers/index.ts` — фабрика моделей, типы
2. `src/providers/openai.ts` — обёртка OpenAI (проще всего для тестирования)
3. `src/providers/anthropic.ts` — обёртка Anthropic
4. `src/providers/gigachat.ts` — обёртка GigaChat (с CORS proxy)
5. `src/ui/settings.ts` — динамическая форма настроек
6. `src/ui/provider-switcher.ts` — переключатель в хедере
7. Проверить: переключение провайдеров, сохранение credentials

### Этап 3: Базовый чат (без тулов)
1. `src/ui/chat.ts` — рендеринг сообщений с markdown
2. Отправка сообщения → `model.invoke([messages])` → отображение
3. Проверить: простой диалог работает с каждым провайдером

### Этап 4: Встроенные инструменты
1. `src/tools/builtin/execute-js.ts` — JS-песочница
2. `src/tools/builtin/file-system.ts` — файловые операции
3. `src/tools/registry.ts` — реестр тулов
4. `src/ui/file-picker.ts` — выбор рабочей директории
5. Проверить: тулы работают изолированно (вызов из консоли)

### Этап 5: LLM-Loop (агентный цикл)
1. `src/agent.ts` — полный цикл с tool calling
2. System prompt
3. `model.bindTools(tools)` → invoke → обработка tool_calls → ToolMessage → повтор
4. Интеграция с UI: показ каждого шага (tool call → result)
5. Проверить: агент вызывает тулы, использует результаты

### Этап 6: Кастомные тулы
1. `src/tools/custom.ts` — создание DynamicTool из пользовательского кода
2. `src/ui/tool-editor.ts` — UI: список тулов, добавление, редактирование, удаление
3. Сохранение/загрузка из localStorage
4. Проверить: пользовательский тул вызывается агентом

### Этап 7: Полировка и деплой
1. Обработка ошибок (CORS, network, таймауты, невалидный API key)
2. Тёмная/светлая тема
3. `npm run build` → проверка
4. GitHub Pages деплой

---

## Верификация

| Шаг | Что проверяем | Ожидаемый результат |
|-----|--------------|-------------------|
| 1 | `npm run dev` | Страница открывается в браузере |
| 2 | Выбор провайдера OpenAI | Форма с полем API Key и Model |
| 3 | Переключение на GigaChat | Форма меняется на Authorization Key + Scope |
| 4 | Отправка сообщения (OpenAI) | Ответ отображается с markdown |
| 5 | Переключение на Anthropic, отправка сообщения | Работает с другим провайдером |
| 6 | "Посчитай 2+2 через код" | Агент вызывает `execute_js`, показывает результат |
| 7 | Выбор директории + "Прочитай README.md" | Агент вызывает `read_file` |
| 8 | Добавление кастомного тула | Тул появляется в списке, агент может его вызвать |
| 9 | `npm run build` | Папка `dist/` с рабочим приложением |
| 10 | GitHub Pages | Сайт доступен, всё работает |
