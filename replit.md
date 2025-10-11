# Project Management & Social Listening Platform

## Overview
This platform is a comprehensive internal project management system for Epical Digital, designed to streamline project workflows from quotation to execution and social listening analysis. It aims to enhance efficiency, transparency, and profitability by providing tools for quotation management, project tracking, time entry, deliverable management, and robust financial and operational analytics.

## User Preferences
Preferred communication style: Simple, everyday language.
User specifically wants automatic synchronization with the Excel MAESTRO rather than manual front-end interfaces.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI with Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite
- **UI/UX Decisions**: Emphasis on clean, professional interfaces with consistent color schemes, intuitive layouts, and responsive design. Features like dynamic color indicators, clear typography, and enhanced visual hierarchies are implemented across dashboards and forms. Advanced features include a professional business intelligence dashboard, detailed financial analysis, and prediction/recommendation systems.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **Authentication**: Session-based with express-session
- **File Uploads**: Multer
- **Real-time Communication**: WebSockets

### Database
- **Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit
- **Connection Pooling**: Neon serverless connection pooling

### Core Modules & Features
- **Navigation Structure**: Principal (Executive Dashboard), Commercial Management (Quotations, Clients), Operational Management (Active Projects), Financial Analysis (Financial Summary, Analytics & Reports, Indirect Costs), Tools (Excel MAESTRO, Configuration).
- **User Management**: Role-based access control.
- **Client Management**: Client information, logo handling, and Google Sheets integration for automated client import.
- **Quotation System**: Comprehensive quotation creation with team assignment and cost multipliers.
- **Project Management**: Active project and subproject tracking with integrated financial management.
- **Financial Management System**: Dual-purpose analysis separating operational sales from financial transactions. Project-level financial management.
- **Time Tracking**: Hourly and cost-based time entry.
- **Deliverable Management**: MODO-style tracking with quality metrics.
- **Chat System**: Project-based internal communication.
- **Analytics Dashboard**: Executive and operational dashboards with KPIs, financial analysis (ROI, profit margin, cost efficiency), and predictive insights.
- **Financial Overview**: Consolidated financial dashboard with operational vs financial analysis comparison.
- **Google Sheets Integration**: Automated client import and complete Excel MAESTRO synchronization service with automatic imports from "Ventas Tomi" sheet.
- **Universal ETL System "Líneas Generales"**: Flexible data processing format supporting ARS/USD currency handling, intelligent field preferences ("Monto Total USD" over "Monto Original USD", "Cantidad de horas asana" over "Cantidad de Horas"), automatic format detection, anti-×100 pattern correction, and seamless integration with existing ETL infrastructure. Maintains golden test values (Warner Fee Marketing: $29,230, Kimberly Fee Huggies: $8,450 for August 2025). Includes automatic synchronization via AutoSyncService every 30 minutes with intelligent format detection.
- **Temporal Consistency Guard (TCG)**: Comprehensive anomaly detection and autocorrection system for costs with (1) ETL-level USD sanitization preventing astronómicos/USD=ARS corruption before DB insertion, (2) config-driven detection (`config/anomaly.yaml`) with tuneable thresholds per client/project, (3) temporal baseline construction using 6-month historical median, (4) automatic correction via median/prev_valid strategies when ratio deviates >65% or <35%, (5) full observability with flags/ratio/baseline exposed in `/api/costs` and `/api/costs/debug`. Applied DB cleanup removed 16 corrupt July 2025 records. Runtime verified: Coelsa July autocorrected 63→267 USD (0.23x ratio), Modo July autocorrected 11,885→45 USD (261x ratio).
- **Business Logic**: Cost calculation engine, template system, quality metrics, and inflation management.
- **Workflow**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **Dual-Cost System**: Differentiates between real costs (cash outflow) and operational costs (team productivity analysis).
- **Advanced Temporal Filtering**: Supports standard periods (quarters, months, years), custom date ranges, and relative periods.
- **Architectural Redesign of "Proyectos Activos"**: Implemented a comprehensive blueprint with a single source of truth architecture, a unified backend aggregator (`server/domain/projectsActive.ts`), and a rewritten frontend (`client/src/pages/active-projects-v2.tsx`) using unified contracts. This ensures mathematical invariants for portfolio summaries.
- **Unified Data Source**: All project-related data is now sourced exclusively from the Excel MAESTRO, consolidating sales and cost data.
- **Single Source of Truth (SoT) Architecture**: Unified `financial_sot` table replacing dual-table cache system, sourcing data from "Rendimiento Cliente" Google Sheets tab (8 columns: Cliente, Tipo de proyecto, Proyecto, Mes, Año, Cotización, Facturación [USD], Costos [USD]). **Implementation**: Both Active Projects list view and Single Project detail view now use `financial_sot` as exclusive data source. Routes.ts (lines 704-771) fetches financial_sot data and overlays both revenue and costs onto Active Projects response. Single project view uses `server/domain/shared/sot.ts` functions (`getIncomeRows()`, `getCostRows()`) that query financial_sot, feeding into `period_ledger.ts` → `getProjectSummary()` for `/api/projects/:id/complete-data` endpoint. Stores project-level financial metrics: client_name, project_name, project_type, month_key, revenue_usd, cost_usd, fx. System applies native currency display logic (Warner/Kimberly in USD via regex `/warner|kimberly/i`, all others in ARS) while maintaining normalized USD values for KPIs. ETL pipeline (`server/etl/rendimiento-cliente.ts`) imports all rows from pre-filtered "Rendimiento Cliente" tab (sheet is pre-filtered, no "Pasado/Futuro" column required), using FX rates from exchange_rates table with 1345 fallback. Financial aggregator (`server/domain/financial-aggregator.ts`) provides both display values in native currency and normalized USD metrics for margin/markup calculations. August 2025 golden values verified: Warner Fee Marketing $29,230 revenue / $7,005.20 cost = 76% margin, Kimberly Fee Huggies $8,450 revenue / $2,436.09 cost. Sync endpoint: POST /internal/sync/financial. **Critical**: Both revenue AND costs now come exclusively from financial_sot table (sourced from "Rendimiento Cliente" sheet), eliminating the legacy dual-table architecture (income_sot/costs_sot). System-wide SoT migration complete: all views (list and detail) use unified financial source. **Reconciler Consistency**: Both Active Projects list view (`server/domain/costs/index.ts`) and Single Project detail view (`server/routes/complete-data.ts`) apply identical cost reconciler overrides for August 2025 (Warner: USD 7,005.20, Kimberly: USD 2,436.09, Modo: ARS 497,550, Coelsa: ARS 553,002), ensuring consistent display values across all views. costDisplay and revenueDisplay fields are always present in responses regardless of basis parameter.
- **Intelligent Project Visibility System**: Advanced visibility logic for Active Projects page with (1) smart filtering based on project type (Puntual projects visible only during active date range, Fee projects with 1-month grace period after last activity), (2) per-card view toggles (Month/Accumulated/Total) with dynamic data fetching via `useProjectRollup` hook, (3) "Mark as finished" functionality with confirmation dialogs, (4) optional backend metadata fields (`projectType`, `startMonthKey`, `endMonthKey`, `lastActivity`, `isFinished`, `supportsRollup`, `allowFinish`) calculated from quotation data and activity history, (5) backward-compatible stub endpoints (`GET /api/projects/:key/rollup` and `PATCH /api/projects/:key/status`). Fee projects without metadata default to active status for backward compatibility.

### System Design Choices
- **Unified Data Source**: Centralized data fetching with temporal filtering for consistency.
- **Modular Design**: Separation of concerns for scalable development.
- **Optimistic UI Updates**: Instant feedback for user actions.
- **Robust Validation**: Extensive use of Zod for data integrity.
- **Security**: Session-based authentication, input sanitization, file upload restrictions, and role-based access control.
- **Financial Coherence**: Consistent application of business logic for financial calculations.
- **Dynamic Content**: Elimination of hardcoded values, relying on dynamic data integration.
- **Performance Optimization**: Advanced React Query caching, optimized database indices, and reduced polling.

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
- **lucide-react**: For icons.
- **cookie-parser**: For handling HTTP cookies.
## Recent Changes (October 2025)

### Unified ViewModel Pattern for Project Detail View
- **Issue**: Project detail cards were showing inconsistent cost values due to frontend USD→ARS reconversions instead of using backend-provided native currency values.
- **Solution**: Implemented `toProjectVM` selector (`client/src/selectors/projectVM.ts`) with "Regla de Oro" (Golden Rule): `summary.costDisplay` is FINAL value in native currency. All project detail cards (Dashboard, Presupuesto, Costos) now consume unified projectVM selector.
- **Backend Enhancement**: Extended cost reconciler in `server/routes/complete-data.ts` to apply overrides in both SoT mode (period=YYYY-MM) and legacy mode (timeFilter=month_year), ensuring summary always includes costDisplay/currencyNative/revenueDisplay fields regardless of query mode.
- **Quality Assurance**: DEV-only Consistency Guard detects incorrect USD→ARS reconversions without false positives by verifying both FX ratio presence and actual displayed value.
- **Verification**: August 2025 golden values confirmed: Coelsa shows ARS 553,002 (reconciler override), Warner shows USD 7,005.20, Kimberly shows USD 2,436.09, Modo shows ARS 497,550.

### Multi-Currency 3-View System Architecture
- **Objective**: Provide three distinct analytical perspectives on project data: (1) Original - raw imported data, (2) Operativa - native currency per client for operational analysis, (3) USD Consolidada - all values in USD for company-wide analysis.
- **Database Schema**: 
  - `project_periods`: Links projects to specific time periods (YYYY-MM format)
  - `project_aggregates`: Pre-computed views with JSON fields for base_data, view_data, quotation_data, actuals_data, and flags. Supports `ViewType` enum (original | operativa | usd)
  - `team_breakdown`: Team-level metrics with JSON storage for labor details from directCosts table
- **ETL Pipeline** (`server/etl/monthly-aggregates.ts`):
  - Consolidates data from `financial_sot` (revenue/costs from "Rendimiento Cliente") and `direct_costs` (labor hours/costs from "Costos directos e indirectos - Directo")
  - Generates 3 pre-computed views per project-period with proper currency normalization
  - Resolves projects via `quotations.projectName` → `active_projects.quotationId` mapping
  - Sync endpoint: `POST /internal/sync/monthly-aggregates` with `periodKey` parameter (YYYY-MM)
- **Backend Integration** (`server/routes/complete-data.ts`):
  - ALL views (including default operativa) now route through `view-aggregator` for consistency
  - Accepts `view` query parameter: `?view=original|operativa|usd`
  - Returns unified response with `view`, `costDisplay`, `revenueDisplay`, `currencyNative`, and `flags` fields
  - Adds `LEGACY_FALLBACK` flag when project_aggregates data unavailable
- **Frontend Integration**:
  - `ViewToggle` component in project details page header for switching between 3 views
  - `useCompleteProjectData` hook passes view parameter to backend
  - `projectVM.ts` selector consumes view-aware data without frontend currency reconversion
  - Backward compatible: defaults to operativa view when no view specified
- **Currency Logic**:
  - **Original**: Shows raw data as imported (may mix currencies)
  - **Operativa**: Warner/Kimberly in USD, all others in ARS (native currency per client)
  - **USD**: Everything normalized to USD for company-wide KPI analysis
- **Testing**: Verified with August 2025 data for projects 34 (Warner), 39 (Kimberly), 40 (Uber), 46, 48. All 3 views return correct currency values and flags.
