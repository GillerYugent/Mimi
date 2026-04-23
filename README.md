# Mimi

Веб-платформа **Mimi** — рабочее пространство для разработчиков: задачи, документы, канвасы, команды и Git-интеграция в одном месте.

Реализация пользовательского приложения из практических работ №1–14 по дисциплине «Системная и программная инженерия» (РТУ МИРЭА, 2026).

## Что реализовано

- **Auth.** Регистрация, вход, смена пароля, редактирование профиля. JWT-like access/refresh токены (access 15 мин, refresh 7 дней — как в ТЗ), «bcrypt-подобное» хэширование пароля.
- **Dashboard.** Список активных проектов, статистика задач по проекту.
- **Проекты.** Создание, архивирование, удаление с подтверждением, иконки, описания.
- **Tasks / Kanban.** 5 колонок (Backlog → To Do → In Progress → Review → Done) с drag-and-drop, подзадачами, метками, приоритетами, дедлайнами и исполнителями. Фильтрация в реальном времени. Привязка задачи к коммиту / PR.
- **Docs.** Notion-подобный блочный редактор: заголовки H1/H2/H3, списки, чек-листы, цитаты, код, разделители, markdown-сокращения (`# `, `## `, `- `, `[] `, ...). Вложенные подстраницы (дерево). История изменений с восстановлением версий. Поиск.
- **Boards (Canvas).** Бесконечный канвас с пан/зумом: блоки, стикеры, текст, mind-map узлы, стрелки. Drag элементов, inline-редактирование текста.
- **Team.** Создание команды на проект, приглашение по email, произвольные роли (Backend/Frontend/Designer/QA + любые), гибкие разрешения (view/edit для Docs/Tasks/Boards + управление командой).
- **Git-интеграция.** Подключение GitHub/GitLab репозитория (demo OAuth), просмотр коммитов и Pull Requests, связь задачи с коммитом.
- **My Space.** Изолированное личное пространство: заметки, задачи и канвасы, недоступные другим пользователям.
- **Уведомления.** SSE-подобная система (реализована через Zustand `subscribe`): назначение задачи, изменение статуса, приглашение в команду. Настройка типов в профиле.
- **Архив.** Отдельный раздел для архивированных проектов с возможностью восстановления или безвозвратного удаления.

## Дизайн

Монохромная палитра в стиле Notion:
- Фон страницы `#ffffff`
- Sidebar `#f7f7f5`, hover `#efefee`, active `#e8e8e6`
- Текст `#37352f` (тёмно-графитовый, не чистый чёрный)
- Тонкие линии-разделители `rgba(55, 53, 47, 0.09)`
- Засечный шрифт (serif) для заголовков страниц, sans-serif для тела
- Никаких цветных акцентов — только оттенки серого + минимальный красный для ошибок

## Запуск

```bash
npm install
npm run dev          # dev-сервер на http://localhost:5173
npm run build        # production-сборка
npm run preview      # превью прод-сборки
```

Все данные хранятся в `localStorage` вашего браузера (в реальной системе — PostgreSQL + Redis через микросервисы, см. архитектуру ТЗ).

## Стек

- **React 18 + TypeScript 5** — UI
- **Vite 5** — сборщик
- **React Router 6** — роутинг
- **Zustand 4** — управление состоянием с `persist`-мидлваром
- **Tailwind CSS 3** — утилитарные стили

## Структура

```
src/
├── App.tsx                      # роутинг
├── main.tsx
├── index.css                    # Tailwind base + компоненты (кнопки, инпуты, chip, ...)
├── types/                       # все доменные типы (User, Project, Task, DocPage, ...)
├── utils/                       # id/hash/jwt/dates
├── store/
│   ├── authStore.ts             # пользователи, сессии
│   ├── projectStore.ts          # проекты + моки коммитов
│   ├── taskStore.ts             # задачи, подзадачи, фильтры, статистика
│   ├── docStore.ts              # страницы + версии + дерево
│   ├── boardStore.ts            # канвасы и элементы
│   ├── teamStore.ts             # команды, роли, приглашения
│   └── notificationStore.ts     # уведомления
├── hooks/
│   └── useNotificationEffects.ts # генерация уведомлений при изменении задач
├── components/
│   ├── ui/                      # Button, Input, Modal, Dropdown, Icon
│   ├── layout/                  # Sidebar, Topbar, Layout
│   ├── tasks/                   # KanbanBoard, TaskModal
│   ├── docs/                    # BlockEditor, DocsPane
│   ├── boards/                  # CanvasView, BoardsPane
│   ├── team/                    # TeamPane
│   ├── git/                     # GitPane
│   ├── project/                 # OverviewPane
│   └── my-space/                # MySpaceTasks
└── pages/
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    ├── DashboardPage.tsx
    ├── MySpacePage.tsx
    ├── ProjectPage.tsx          # Overview | Tasks | Docs | Boards | Team | Git
    ├── NotificationsPage.tsx
    ├── SettingsPage.tsx
    └── ArchivePage.tsx
```

## Соответствие требованиям из практик

| Раздел ТЗ / практик | Реализовано |
| --- | --- |
| User stories (§ практика 2) | 15+ сценариев покрыты |
| Kanban с подзадачами и метками | KanbanBoard + TaskModal |
| Notion-подобный редактор + подстраницы + история | DocsPane + BlockEditor + `saveVersion`/`restoreVersion` |
| Канвас с блоками/стрелками/стикерами | CanvasView |
| My Space, изолированный от проектов | MySpacePage + scope-фильтры во всех store |
| Команды, роли, права | TeamPane + RolePermissions |
| Git-интеграция (коммиты, PR, связь с задачей) | GitPane + поля `commitSha`/`pullRequestUrl` в Task |
| Уведомления с настройками | useNotificationEffects + NotificationsPage |
| Архив / восстановление / удаление с подтверждением | ArchivePage + Confirm |
| Bcrypt-стиль хэши + JWT access/refresh | utils/id.ts + authStore |
| Адаптивность 360–2560px | Tailwind + адаптивные grid |

В этом MVP backend эмулируется клиентскими сторами. Архитектурный контракт описан в практических работах: 9 микросервисов на Go, PostgreSQL per service, Redis, NGINX, Docker Compose — реализация серверной части выходит за рамки учебного MVP.
