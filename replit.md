# Project Management & Social Listening Platform

## Overview
This platform is an internal project management system for Epical Digital, designed to streamline project workflows from quotation to execution and social listening analysis. It aims to enhance efficiency, transparency, and profitability by providing tools for quotation management, project tracking, time entry, deliverable management, and robust financial and operational analytics. The business vision is to provide a unified platform for project, financial, and operational management, offering clear insights into profitability and team performance, with a strong focus on integrating with existing Google Sheets workflows.

## User Preferences
Preferred communication style: Simple, everyday language.
User specifically wants automatic synchronization with the Excel MAESTRO rather than manual front-end interfaces.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: TanStack Query
- **UI Components**: Radix UI with Tailwind CSS
- **UI/UX Decisions**: Clean, professional interfaces with consistent color schemes (simplified to green/red/gray for status), intuitive layouts, responsive design, dynamic color indicators, clear typography, and enhanced visual hierarchies.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **Authentication**: Session-based
- **Real-time Communication**: WebSockets

### Database
- **Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit

### Core Modules & Features
- **Task Management Module (Asana-style)**: Full Asana-style task management system with 6 views/pages:
  - `/tasks` — **Home page** with widgets: "Mis tareas" (upcoming/overdue/done tabs), "Proyectos recientes" (grid 2x3), "Tareas que asigné" (tasks created by user but assigned to others)
  - `/tasks/my-tasks` — Personal weekly calendar view with task cards
  - `/tasks/team-calendar` — Monthly team calendar with person/project filters
  - `/tasks/hours-dashboard` — Consolidated hours dashboard with charts
  - `/tasks/projects` — Projects Hub grid with member avatars, task stats, join/leave
  - `/tasks/projects/:id` — Project detail with sticky header (breadcrumb, color icon, member avatars, "Compartir" button, "Miembros" sheet) + **Lista/Tablero tabs** (kanban board with 3 columns: Por hacer / En progreso / Completado)
  - **ProjectTaskList component** supports `view="list"` (Asana-style table with sections) and `view="board"` (3-column kanban)
  - DB tables: `tasks`, `task_time_entries`, `task_project_members` (projectId, personnelId, role owner|member), `task_own_projects` (standalone projects not tied to active_projects)
  - API: `/api/tasks/*`, `/api/tasks-personnel`, `/api/tasks/projects` (includes own projects), `/api/tasks/projects/create` (POST), `/api/tasks/projects/:id/members`
  - Sidebar: "GESTIÓN DE TAREAS" section includes "Inicio", "Mis Tareas", **"Proyectos"** (direct link to hub), "Calendario Equipo", "Panel de Horas" + "PROYECTOS" subsection with color icon squares per project and "+" button that opens NewProjectDialog
  - UX: Animated circle checkboxes (not square), inline date picker popover per task row, user avatar in home greeting, "Mostrar más" expand/collapse, badge counts on tabs
  - **Asana-parity UI** (latest iteration):
    - **Toolbar**: "Agregar tarea" CTA + Filtrar/Ordenar/Agrupar/··· decorative buttons above the task list in `view="list"`
    - **Date ranges**: Task rows show "26 feb – 3 mar" when both `startDate` and `dueDate` are set; otherwise shows single date or arrow suffix
    - **Subtask badges**: Subtasks hidden by default; badge `"N↓"` appears next to task title with count; click toggles expand/collapse inline
    - **Client tag column**: New "Cliente" column with color-coded pill badges per task row, color derived from client name hash
    - **Time format**: "30min" for < 1h, "1h 30min" for >= 1h (removed "0h 30min" format)
    - **Section management**: Hover on section header reveals "+" (add task) + "···" (DropdownMenu) with Renombrar/Eliminar; rename is inline, delete moves tasks to "General"
    - **TaskDetailPanel (Asana-style)**: Auto-save on blur/select for all fields; status pills; priority pills; responsable with avatar; collaborators as chips with ×; date range pickers; estimated hours; description textarea; subtasks with circle checkboxes; time log form + history; delete with confirmation alert
  - **Backend**: `GET /api/tasks/project/:projectId` now returns `subtaskCount` per task; `PUT /api/tasks/section/rename` and `DELETE /api/tasks/section` endpoints added
  - `TaskProject.clientName` typed as `string | null` to prevent crashes on own projects (id >= 1,000,000)
  - **FK constraints removed**: `tasks.project_id` and `task_project_members.project_id` have NO FK to `active_projects` — required so own project IDs (≥1,000,000) work without constraint violations
  - **Toolbar "Agregar tarea"**: Uses a counter prop (`autoOpenAdd: number`) on SectionBlock so repeated clicks always re-trigger the inline add row
  - **Subtask invalidation**: Adding a subtask in TaskDetailPanel now invalidates `/api/tasks/project` so the badge count in the list refreshes immediately
  - Separate from financial analysis — accessible to all team members with `projects` permission.
- **Sales CRM Module**: Kanban pipeline, lead/contact management, activity timelines, reminders, email integration.
- **User & Client Management**: Role-based access control and Google Sheets integration for client import.
- **Quotation System**: Comprehensive creation with team assignment and cost multipliers, supporting dual-currency rates (ARS/USD).
- **Project Management**: Active project and subproject tracking with integrated financial management.
- **Financial Management System**: Project-level financial management with P&L tables and cash flow tracking. All financial analysis is consolidated in the Executive Dashboard (sourced from Excel MAESTRO sync). The standalone "Análisis Financiero" section (Resumen Financiero, Analytics & Reportes, Costos Indirectos) and "Excel MAESTRO" admin page have been removed from the UI; their backend APIs and sync services remain active.
  - **Sidebar naming**: The `/active-projects` module (financial rentability analysis of client projects) is labeled **"Rentabilidad"** under "Gestión Operacional" to distinguish it from the task management **"Proyectos"** module in "Gestión de Tareas".
- **Time & Deliverable Tracking**: Hourly and cost-based time entry, MODO-style deliverable tracking with quality metrics.
- **Analytics Dashboard**: Executive and operational dashboards with KPIs, financial analysis (ROI, profit margin, cost efficiency), predictive insights, and context-aware business intelligence alerts (e.g., `NO_BILLING_WITH_COSTS`, `BILLABLE_DROP`, `FX_SHIFT`, `OVER_BURN`). Features advanced temporal filtering and a dual-view system separating operational and financial perspectives.
- **Google Sheets Integration**: Automated client import and complete Excel MAESTRO synchronization for various financial data sheets ("Ventas Tomi", "Rendimiento Cliente", "CashFlow", "Activo"). The "Resumen Ejecutivo" sheet only has data through April 2025; newer periods use the "Activo" sheet as source of truth for caja_total and total_activo.
- **Universal ETL System "Líneas Generales"**: Flexible data processing with currency handling, intelligent field preferences, automatic format detection, and anti-×100 pattern correction.
- **Temporal Consistency Guard (TCG)**: Anomaly detection and autocorrection system for costs.
- **Business Logic**: Cost calculation engine, template system, quality metrics, inflation management.
- **Workflow Automation**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **Dual-Cost System**: Differentiates between real costs (cash outflow) and operational costs (team productivity analysis).
- **Single Source of Truth (SoT) Architecture**: Unified `financial_sot` table sourcing project data exclusively from "Rendimiento Cliente" Google Sheets, with a robust ETL pipeline and Star Schema for analytics.
- **Multi-Currency 3-View System Architecture**: Provides "Original", "Operativa" (native currency), and "USD Consolidada" perspectives.
- **Team Breakdown System**: ETL processes Excel MAESTRO "Costos directos e indirectos" for `targetHours`, `hoursAsana`, and `hoursBilling`.
- **Deterministic + Fuzzy Project Resolver V2**: 3-stage cascade resolution for project matching.
- **One-Shot Project Visualization System**: Dual-view system for one-shot projects with intelligent period visibility.
- **Devengado Calculation V2**: Excel MAESTRO-aligned formula: `Devengado = Facturado - Provisión Facturación Adelantada`.
- **Debug Summary Endpoint**: `/api/dashboard/debug/summary` for comparing Excel MAESTRO vs App calculations with discrepancy detection.

### System Design Choices
- **Unified Data Source**: Centralized data fetching with temporal filtering using a Single Source of Truth (SoT) architecture.
- **Modular Design**: Separation of concerns for scalable development.
- **Optimistic UI Updates**: Instant feedback for user actions.
- **Robust Validation**: Extensive use of Zod for data integrity.
- **Security**: Session-based authentication, input sanitization, file upload restrictions, and role-based access control.
- **Financial Coherence**: Consistent application of business logic for financial calculations.
- **Dynamic Content**: Elimination of hardcoded values, relying on dynamic data integration.
- **Performance Optimization**: Advanced React Query caching, optimized database indices, and reduced polling.
- **Unified ViewModel Pattern**: Ensures consistent cost and revenue display across all project detail cards.
- **Type Safety**: Full TypeScript type coverage with explicit type definitions.

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless database connection.
- **drizzle-orm**: Type-safe database ORM.
- **express**: Web application framework for Node.js.
- **react**: Frontend framework.
- **@tanstack/react-query**: Server state management for React.
- **zod**: Runtime type validation.
- **@radix-ui/***: Accessible UI component primitives.
- **vite**: Build tool and development server.
- **typescript**: Language for type checking and compilation.
- **tailwindcss**: Utility-first CSS framework.
- **drizzle-kit**: Database schema management and migrations.
- **multer**: For handling file uploads.
- **express-session**: For session-based authentication.
- **ws**: For WebSocket communication.
- **Recharts**: For professional charting in analytics dashboards.
- **node-cron**: For scheduled task automation (daily SoT ETL synchronization).
- **fuse.js**: For fuzzy string matching in project resolver.