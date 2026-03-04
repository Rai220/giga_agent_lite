# GigaAgent Lite

Браузерный LLM-агент с поддержкой GigaChat, OpenAI и Anthropic. Работает полностью на клиенте — без backend, без серверов. Развёрнут на GitHub Pages.

**[Открыть приложение →](https://rai220.github.io/giga_agent_lite/)**

---

## Что это

GigaAgent Lite — не просто чат-обёртка, а **настоящий агент**. Он умеет самостоятельно решать, когда нужно вызвать инструмент (например, выполнить код), интерпретировать результат и продолжить работу.

```
Пользователь: "Посчитай сумму чисел от 1 до 100"

Агент думает → вызывает execute_js →
  let sum = 0;
  for (let i = 1; i <= 100; i++) sum += i;
  return sum;
→ Result: 5050

Агент: "Сумма чисел от 1 до 100 равна 5050"
```

### Возможности

- **Агентный цикл (ReAct)** — LLM в цикле вызывает инструменты и анализирует результаты (до 15 итераций)
- **execute_js** — выполнение JavaScript в sandboxed iframe (вычисления, обработка данных, работа с датами)
- **Мульти-провайдер** — переключение между GigaChat, OpenAI, Anthropic на лету
- **История переписок** — все диалоги сохраняются в localStorage, можно вернуться к любому
- **Настройки** — API-ключи хранятся в localStorage браузера, никуда не отправляются
- **Markdown** — ответы рендерятся с поддержкой заголовков, списков, таблиц, блоков кода с подсветкой синтаксиса

---

## Быстрый старт

### Онлайн

Просто откройте **https://rai220.github.io/giga_agent_lite/**, нажмите ⚙, введите ключи нужного провайдера и начните диалог.

### Локально

```bash
git clone https://github.com/Rai220/giga_agent_lite.git
cd giga_agent_lite
npm install
npm run dev
```

Откройте http://localhost:5173 в браузере.

---

## Настройка провайдеров

Нажмите ⚙ в правом верхнем углу и заполните поля для выбранного провайдера.

### GigaChat

| Поле | Описание |
|------|----------|
| User | Логин из GigaChat API |
| Password | Пароль |
| Authorization Key | Альтернатива User+Password — Base64-ключ из GigaChat Studio |
| Base URL | URL API (для dev-прокси: `/gigachat-api`) |
| Model | Название модели (`GigaChat`, `GigaChat-2-Pro` и др.) |
| Scope | `GIGACHAT_API_PERS` / `GIGACHAT_API_B2B` / `GIGACHAT_API_CORP` |

> **CORS:** GigaChat API не поддерживает браузерные запросы напрямую. При локальной разработке Vite проксирует запросы автоматически (если задан `GIGACHAT_BASE_URL`). Для production нужен CORS-прокси.

### OpenAI

| Поле | Описание |
|------|----------|
| API Key | Ключ из [OpenAI Dashboard](https://platform.openai.com/api-keys) |
| Model | `gpt-4o`, `gpt-4o-mini`, и др. |

### Anthropic

| Поле | Описание |
|------|----------|
| API Key | Ключ из [Anthropic Console](https://console.anthropic.com/) |
| Model | `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`, и др. |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                        Браузер                          │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  UI чата  │──▶│  Agent Loop  │──▶│ LLM Provider   │  │
│  │          │◀──│  (while)     │◀──│ GigaChat/OAI/… │  │
│  └──────────┘   └──────┬───────┘   └────────────────┘  │
│                         │                               │
│                         ▼                               │
│                  ┌─────────────┐                        │
│                  │ execute_js  │                        │
│                  │ (sandbox)   │                        │
│                  └─────────────┘                        │
│                                                         │
│  localStorage: credentials, conversations, settings     │
└─────────────────────────────────────────────────────────┘
```

### Агентный цикл

```
Сообщение пользователя
        │
        ▼
┌────────────────────────────────┐
│     ЦИКЛ (макс. 15 итераций)  │
│                                │
│  response = LLM.chat(messages) │
│        │                       │
│  function_call в ответе?       │
│    НЕТ → break, вернуть текст │
│    ДА  → выполнить инструмент  │
│          добавить результат    │
│          → следующая итерация  │
└────────────────────────────────┘
```

---

## Стек

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| Сборка | **Vite** | Dev-сервер с HMR, production-бандлинг |
| Язык | **TypeScript** | Типизация |
| GigaChat | **gigachat** (npm) | Прямой SDK с function calling |
| OpenAI | **@langchain/openai** | LangChain-обёртка |
| Anthropic | **@langchain/anthropic** | LangChain-обёртка |
| Markdown | **marked** | Рендеринг ответов |
| Подсветка | **highlight.js** | Синтаксис в блоках кода |
| Хостинг | **GitHub Pages** | Автодеплой через GitHub Actions |

---

## Структура проекта

```
src/
├── main.ts                 # Точка входа, обработка событий
├── agent.ts                # Агентный цикл с tool calling
├── types.ts                # Общие типы
├── storage.ts              # localStorage: настройки, история
├── styles.css              # Стили (dark theme)
├── providers/
│   ├── index.ts            # Фабрика моделей (OpenAI/Anthropic)
│   ├── openai.ts           # ChatOpenAI
│   └── anthropic.ts        # ChatAnthropic
├── tools/
│   ├── definitions.ts      # Описания инструментов (GigaChat function format)
│   └── execute-js.ts       # JS-песочница (sandboxed iframe)
└── ui/
    ├── chat.ts             # Рендеринг сообщений + tool calls
    ├── settings.ts         # Модалка настроек
    └── sidebar.ts          # Боковая панель с историей
```

---

## Разработка

```bash
npm install          # Установка зависимостей
npm run dev          # Dev-сервер (http://localhost:5173)
npm run typecheck    # Проверка типов
npm run build        # Production-сборка → dist/
npm run preview      # Предпросмотр production-сборки
```

### Переменные окружения (опционально)

При локальной разработке можно задать переменные для автозаполнения настроек GigaChat:

```
GIGACHAT_USER=...
GIGACHAT_PASSWORD=...
GIGACHAT_BASE_URL=https://your-api.example.com/api/v1
GIGACHAT_MODEL=GigaChat
```

Vite автоматически настроит прокси `/gigachat-api` → `GIGACHAT_BASE_URL` и подставит креды в форму настроек.

---

## Безопасность

- API-ключи хранятся **только** в `localStorage` вашего браузера
- JavaScript выполняется в **sandboxed iframe** — без доступа к DOM, localStorage, cookies основной страницы
- Таймаут выполнения кода — 10 секунд
- В production-сборке нет никаких встроенных ключей

---

## Лицензия

MIT
