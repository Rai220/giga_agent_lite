# Агенты и стек — GigaChat Browser Agent

## Что такое "агент" в контексте этого проекта

Агент — это программа, которая:
1. Получает задачу от пользователя на естественном языке
2. Решает, какие **инструменты** (tools) нужно использовать
3. Выполняет инструменты и анализирует результаты
4. Повторяет шаги 2-3 пока задача не решена
5. Возвращает финальный ответ пользователю

В отличие от простого чат-бота, агент **действует**, а не только отвечает.

```
Чат-бот:    Вопрос → Ответ
Агент:      Задача → [Думает → Действует → Наблюдает] × N → Результат
```

---

## Архитектура агента

### LLM — мозг агента

**GigaChat** (модели: GigaChat, GigaChat-2-Pro, GigaChat-2-Max)

LLM отвечает за:
- Понимание задачи пользователя
- Принятие решения: нужен ли инструмент и какой
- Формирование вызова функции (имя + аргументы)
- Интерпретация результатов
- Генерация финального ответа

GigaChat поддерживает **function calling** — механизм, при котором модель может вернуть не текст, а структурированный вызов функции:

```json
{
  "function_call": {
    "name": "execute_js",
    "arguments": "{\"code\": \"2 + 2\"}"
  }
}
```

### Инструменты — руки агента

| Инструмент | Описание | Технология | Ограничения |
|-----------|----------|-----------|-------------|
| `execute_js` | Выполнение JavaScript кода | Sandboxed iframe | Нет доступа к DOM страницы, таймаут 10с |
| `read_file` | Чтение файла с диска | File System Access API | Только Chrome/Edge, нужно разрешение пользователя |
| `write_file` | Запись файла на диск | File System Access API | Только Chrome/Edge, подтверждение перед записью |
| `list_directory` | Список файлов в папке | File System Access API | Только Chrome/Edge, глубина до 3 уровней |

### Цикл работы (подробная схема)

```
┌──────────────────────────────────────────────────────────────┐
│  ПОЛЬЗОВАТЕЛЬ: "Прочитай package.json и скажи версию node"   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  АГЕНТ → GigaChat API                                        │
│  messages: [                                                  │
│    { system: "Ты агент, у тебя есть инструменты..." },       │
│    { user: "Прочитай package.json и скажи версию node" }     │
│  ]                                                           │
│  functions: [execute_js, read_file, write_file, list_dir]    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  GigaChat ОТВЕЧАЕТ:                                          │
│  function_call: {                                            │
│    name: "read_file",                                        │
│    arguments: { "path": "package.json" }                     │
│  }                                                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  БРАУЗЕР ВЫПОЛНЯЕТ read_file("package.json")                 │
│  Результат: '{ "name": "my-app", "engines": {"node":"18"}}' │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  АГЕНТ → GigaChat API (повторный запрос)                     │
│  messages: [                                                  │
│    { system: "..." },                                        │
│    { user: "Прочитай package.json..." },                     │
│    { assistant: function_call{read_file} },                  │
│    { function: name="read_file", content="{ ... }" }         │
│  ]                                                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  GigaChat ОТВЕЧАЕТ (текст):                                  │
│  "В package.json указана версия Node.js 18."                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  ПОЛЬЗОВАТЕЛЬ ВИДИТ:                                         │
│  📎 read_file("package.json") → { "name": "my-app", ... }   │
│  "В package.json указана версия Node.js 18."                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Стек технологий — подробно

### 1. Vite (сборщик)

**Что:** Сборщик и dev-сервер для frontend-проектов.

**Зачем нам:**
- `gigachat` — npm-пакет, его нужно бандлить для браузера
- TypeScript нужно компилировать в JavaScript
- Горячая перезагрузка при разработке (`npm run dev`)
- Сборка в статические файлы (`npm run build` → `dist/`)

**Альтернативы:** webpack (сложнее), esbuild (меньше фич), Parcel. Vite — лучший баланс простоты и функциональности.

### 2. TypeScript (язык)

**Зачем:**
- Типы для GigaChat API (messages, functions, responses)
- Автодополнение в IDE
- Ловит ошибки на этапе компиляции
- Библиотека `gigachat-js` написана на TypeScript — полная совместимость

### 3. gigachat-js (SDK)

**Что:** Официальная JavaScript/TypeScript библиотека для GigaChat API от Сбера.

**Возможности:**
- Авторизация (credentials, user/password, access token)
- Chat completions (обычные и стриминговые)
- Function calling (определение и обработка)
- Получение списка моделей
- Embeddings
- Поддержка работы в браузере (`dangerouslyAllowBrowser: true`)

**Версия:** последняя из npm (`npm install gigachat`)

### 4. marked (markdown-рендерер)

**Что:** Быстрый парсер и рендерер Markdown → HTML.

**Зачем:** Ответы GigaChat содержат markdown-разметку (заголовки, списки, блоки кода, жирный/курсив). Нужно красиво отображать.

### 5. highlight.js (подсветка кода)

**Что:** Библиотека для подсветки синтаксиса в блоках кода.

**Зачем:** Когда агент показывает код (или результат выполнения), нужна подсветка для читаемости.

### 6. File System Access API (браузерное API)

**Что:** Нативное API браузера для чтения/записи файлов на диске пользователя.

**Поддержка:** Chrome 86+, Edge 86+ (НЕ поддерживается в Firefox и Safari)

**Как работает:**
```typescript
// Пользователь выбирает директорию
const dirHandle = await window.showDirectoryPicker();

// Читаем файл
const fileHandle = await dirHandle.getFileHandle('readme.txt');
const file = await fileHandle.getFile();
const text = await file.text();

// Пишем файл
const writable = await fileHandle.createWritable();
await writable.write('Hello!');
await writable.close();
```

### 7. Web Workers / Sandboxed iframe (браузерное API)

**Что:** Механизм изоляции кода в браузере.

**Как работает sandbox iframe:**
```html
<iframe sandbox="allow-scripts" srcdoc="<script>
  window.addEventListener('message', (e) => {
    try {
      const result = eval(e.data.code);
      parent.postMessage({ result: String(result) }, '*');
    } catch(err) {
      parent.postMessage({ error: err.message }, '*');
    }
  });
</script>"></iframe>
```

Код внутри iframe **полностью изолирован** от основного приложения.

---

## Безопасность

### Credentials

- Хранятся в `localStorage` браузера пользователя
- Никогда не отправляются никуда кроме GigaChat API
- Пользователь может удалить их кнопкой "Выйти"
- В коде приложения нет никаких ключей — каждый пользователь вводит свои

### Выполнение кода

- JavaScript выполняется в **sandboxed iframe**
- Iframe не имеет доступа к DOM основного приложения
- Iframe не имеет доступа к `localStorage` (не может украсть credentials)
- Таймаут 10 секунд предотвращает бесконечные циклы

### Работа с файлами

- Пользователь **явно выбирает** директорию через системный диалог
- Агент может работать **только внутри** выбранной директории
- Перед записью файла — показываем содержимое для подтверждения
- API браузера само контролирует разрешения

---

## Ограничения решения

| Ограничение | Причина | Обходной путь |
|------------|---------|--------------|
| CORS может блокировать запросы | GigaChat API может не отдавать CORS-заголовки | Поддержка CORS-прокси в настройках |
| Файлы только в Chrome/Edge | File System Access API не поддерживается в Firefox/Safari | Показываем предупреждение, остальные инструменты работают |
| Нельзя запускать системные команды | Ограничение браузера | Только JS-код в песочнице |
| Нельзя устанавливать npm-пакеты | Нет Node.js в браузере | Можно расширить Pyodide для Python |
| Один tool call за запрос | Ограничение GigaChat API | Последовательный цикл вместо параллельного |
| Credentials видны в DevTools | Клиентское приложение, нет backend | Предупреждаем пользователя, это осознанный выбор |

---

## Будущие расширения (не в первой версии)

- **Python execution** через Pyodide (Python в WebAssembly)
- **Стриминг ответов** (токен за токеном)
- **История диалогов** (сохранение в IndexedDB)
- **Несколько диалогов** (табы)
- **Кастомные инструменты** (пользователь добавляет свои функции)
- **Экспорт диалога** в markdown-файл

## Требования к тестированию

- **Всегда проверяй работу через UI.** После любых изменений в коде открой приложение в браузере (`npm run dev`) и убедись, что функциональность работает корректно через пользовательский интерфейс. Юнит-тесты и проверка типов не заменяют ручную проверку в UI.
- Проверяй ключевые сценарии: отправка сообщений, переключение провайдеров, вызов инструментов, отображение результатов.
- Если изменение затрагивает визуальную часть — убедись, что вёрстка не сломалась.

---

## Cursor Cloud specific instructions

This is a **frontend-only** Vite + TypeScript project with no backend services. The only required service is the Vite dev server.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, port 5173) |
| Type check / lint | `npm run typecheck` (alias: `npm run lint`) |
| Production build | `npm run build` (outputs to `dist/`) |
| Preview build | `npm run preview` |

### Notes

- The Vite dev server binds to localhost by default. Use `npx vite --host 0.0.0.0` if you need to expose it on all interfaces (e.g. for browser testing from the Desktop pane).
- `npm run build` runs `tsc && vite build`; TypeScript errors will block the build.
- No database, Docker, or external services are required. All LLM API calls are made directly from the browser to external APIs (GigaChat, OpenAI, Anthropic).

### GigaChat-specific caveats

- **Do NOT use `langchain-gigachat` in the browser.** The `langchain-gigachat` package does not forward the `dangerouslyAllowBrowser` option to the underlying `gigachat` SDK, causing a runtime error. Instead, use the `gigachat` npm package directly with `dangerouslyAllowBrowser: true`.
- The `gigachat` npm package depends on Node.js `events` module; the `events` npm polyfill is installed to satisfy this in the browser bundle.
- For development, `vite.config.ts` sets up a proxy `/gigachat-api` → `GIGACHAT_BASE_URL` to avoid CORS issues. GigaChat credentials (`GIGACHAT_USER`, `GIGACHAT_PASSWORD`, `GIGACHAT_BASE_URL`, `GIGACHAT_MODEL`) are injected as build-time defaults via Vite's `define` option and auto-saved to localStorage on first load.
- Settings (API keys) and conversation history are stored entirely in browser `localStorage`; there is no backend.
