# PROJECT_MAP — Task Scheduler

## TECH_STACK
| طبقة | التقنية | الإصدار |
|------|---------|---------|
| UI Framework | React | 19.2.8 |
| Build | Vite | 8.2.0 |
| Storage | localStorage | — |
| Package | npm | 11.6.2 |
| Runtime | Node | 24.11.1 |

## SYSTEM_FLOW
```
┌──────────────────────────────────────────────────┐
│                  App                             │
│  ┌────────────────────────────────────────────┐  │
│  │              Kanban Board                  │  │
│  │  ┌─────────┐ ┌───────────┐ ┌─────────┐   │  │
│  │  │  To Do  │ │ In Progress│ │  Done   │   │  │
│  │  │  (أبيض)  │ │  (أصفر)   │ │ (أخضر)   │   │  │
│  │  │  ┌───┐  │ │  ┌───┐    │ │  ┌───┐  │   │  │
│  │  │  │مهمة│ │ │  │مهمة│    │ │  │مهمة│  │   │  │
│  │  │  └───┘  │ │  └───┘    │ │  └───┘  │   │  │
│  │  │  ┌───┐  │ │           │ │         │   │  │
│  │  │  │+   │  │ │           │ │         │   │  │
│  │  │  └───┘  │ │           │ │         │   │  │
│  │  └─────────┘ └───────────┘ └─────────┘   │  │
│  └────────────────────────────────────────────┘  │
│              ┌──────────────┐                     │
│              │    Modal     │                     │
│              │  TaskForm    │                     │
│              │  + status    │                     │
│              │  + حذف       │                     │
│              └──────────────┘                     │
└──────────────────────────────────────────────────┘
```

**Data Flow:**
1. `useTasks` hook reads from localStorage على mount (ترحيل `pending` → `todo`)
2. إضافة/تحديث/حذف → تعديل state → `useEffect` يكتب localStorage
3. `App` يصفي `tasks` حسب `status` ويعرض في 3 أعمدة
4. سحب مهمة (Drag) بين الأعمدة → `updateTask` يغير `status`
5. النقر على مهمة → modal للتعديل/حذف/تغيير الحالة
6. زر "+" في كل عمود → إضافة مهمة بالحالة الافتراضية لذلك العمود

## ARCHITECTURE

```
src/
├── main.jsx              # Entry → render App
├── App.jsx               # State owner, kanban layout, modal control
├── components/
│   └── TaskForm.jsx      # Add/Edit form with validation + status selector
├── hooks/
│   └── useTasks.js       # localStorage CRUD hook (3 حالات)
└── styles/
    └── app.css           # Single CSS file (dark theme, kanban)
```

### Data Model
```ts
Task {
  id: string,          // auto-generated
  title: string,       // required
  start: string,       // ISO datetime-local (اختياري)
  duration: number,    // minutes (اختياري)
  status: 'todo' | 'in-progress' | 'done'
}
```

### Key Features
- Kanban board (3 أعمدة): To Do (أبيض), In Progress (أصفر), Done (أخضر)
- Drag & Drop بين الأعمدة لتغيير الحالة
- إضافة مهمة من أي عمود (الحالة الافتراضية: العمود المستهدف)
- تعديل/حذف المهام عبر المودال
- localStorage persistence
- ترحيل تلقائي للمهام القديمة (`pending` → `todo`)

## ORPHANS & PENDING

| # | العنصر | الحالة | ملاحظات |
|---|--------|--------|---------|
| 1 | الجدول الزمني (Timeline) | ❌ أزيل | استبدل بـ Kanban |
| 2 | date-fns dependency | ❌ أزيل | لم تعد هناك حاجة لمعالجة الوقت |
| 3 | Timeline / TaskCard components | ❌ أزيلت | استبدلت بالتضمين المباشر في App |
| 4 | تصدير/استيراد المهام | ❌ خارج النطاق | لم يطلب |
