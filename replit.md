# Project Management & Social Listening Platform

## Overview
This platform is an internal project management system for Epical Digital, designed to streamline project workflows from quotation to execution and social listening analysis. It aims to enhance efficiency, transparency, and profitability by providing tools for quotation management, project tracking, time entry, deliverable management, and robust financial and operational analytics. The system features a comprehensive business intelligence dashboard, detailed financial analysis, and prediction/recommendation capabilities.

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
- **UI/UX Decisions**: Emphasizes clean, professional interfaces with consistent color schemes, intuitive layouts, and responsive design, including dynamic color indicators, clear typography, and enhanced visual hierarchies.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **Authentication**: Session-based with `express-session`
- **File Uploads**: Multer
- **Real-time Communication**: WebSockets

### Database
- **Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit
- **Connection Pooling**: Neon serverless connection pooling

### Core Modules & Features
- **Navigation Structure**: Principal (Executive Dashboard), Commercial Management, Operational Management, Financial Analysis, Tools.
- **User & Client Management**: Role-based access control and Google Sheets integration for client import.
- **Quotation System**: Comprehensive creation with team assignment and cost multipliers.
- **Project Management**: Active project and subproject tracking with integrated financial management.
- **Financial Management System**: Dual-purpose analysis (operational sales vs. financial transactions) with project-level financial management.
- **Time & Deliverable Tracking**: Hourly and cost-based time entry, MODO-style deliverable tracking with quality metrics.
- **Chat System**: Project-based internal communication.
- **Analytics Dashboard**: Executive and operational dashboards with KPIs, financial analysis (ROI, profit margin, cost efficiency), and predictive insights.
- **Google Sheets Integration**: Automated client import and complete Excel MAESTRO synchronization service, including automatic imports from "Ventas Tomi" sheet.
- **Universal ETL System "Líneas Generales"**: Flexible data processing with ARS/USD currency handling, intelligent field preferences, automatic format detection, and anti-×100 pattern correction. Features automatic synchronization every 30 minutes.
- **Temporal Consistency Guard (TCG)**: Anomaly detection and autocorrection system for costs, preventing data corruption, using configurable thresholds, temporal baselines, and automatic correction strategies. Full observability is provided.
- **Business Logic**: Cost calculation engine, template system, quality metrics, and inflation management.
- **Workflow Automation**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **Dual-Cost System**: Differentiates between real costs (cash outflow) and operational costs (team productivity analysis).
- **Advanced Temporal Filtering**: Supports standard periods, custom date ranges, and relative periods.
- **Architectural Redesign of "Proyectos Activos"**: Implemented a comprehensive blueprint with a single source of truth architecture, a unified backend aggregator, and a rewritten frontend to ensure mathematical invariants for portfolio summaries.
- **Single Source of Truth (SoT) Architecture**: A unified `financial_sot` table replaces legacy dual-table systems, sourcing all project-related data exclusively from the "Rendimiento Cliente" Google Sheets tab. This system includes native currency display logic while maintaining normalized USD values for KPIs, and a robust ETL pipeline for data import. Both revenue and costs are exclusively sourced from `financial_sot`.
- **Intelligent Project Visibility System**: Advanced logic for the Active Projects page with smart filtering based on project type and activity, per-card view toggles, "Mark as finished" functionality, and optional backend metadata fields.
- **Multi-Currency 3-View System Architecture**: Provides three distinct analytical perspectives: "Original" (raw imported data), "Operativa" (native currency per client for operational analysis), and "USD Consolidada" (all values in USD for company-wide analysis). Data is pre-computed and stored in `project_aggregates` and consumed via a `view-aggregator`.
- **Team Breakdown System (3-Hours Architecture)**: ETL processes Excel MAESTRO "Costos directos e indirectos" sheet with 3 separate hour types: (1) `targetHours` - budgeted hours from Excel (NOT normalized), (2) `hoursAsana` - actual tracked hours with ANTI_×100 normalization (divides by 100 if >500), (3) `hoursBilling` - hours for billing with intelligent fallback (horasParaFacturacion → horasRealesAsana → targetHours). Includes aggregates `totalAsanaHours` and `totalBillingHours` for portfolio-level calculations. All data exposed via `projectVM.teamBreakdown` for consistent display across Dashboard and Team tabs. **On-the-Fly Hydration Hotfix (v2)**: `hydrateMember()` in `view-aggregator.ts` and `complete-data.ts` uses `safeNum()` helper (returns null for invalid inputs) + robust fallback chain (hoursAsana → horasRealesAsana → hours/actualHours → hoursBilling) + ANTI_×100 normalization via `normHours()` (divides by 100 if >500). Uses hoursBilling as proxy when aggregates lack explicit hoursAsana field. Logs warnings for >500h normalizations. Architect-approved hotfix ensures UI displays correct normalized values immediately without ETL re-execution (e.g., Sol Ayala: 2692h → 26.92h, totals: 86.2h ✓).
- **Star Schema SoT (Single Source of Truth) ETL Pipeline**: Comprehensive data warehouse architecture implementing dimensional modeling with fact/dimension tables for robust analytics. Star Schema consists of: (1) `dim_period` - temporal dimension with period_key (YYYY-MM), year, month, business days (populated 2023-01 to 2025-12, 36 periods); (2) `dim_person_rate` - rate catalog with forward-fill logic across periods and role-based baselines, ensuring all 72 person/period combinations have hourly rates with intelligent fallback chain; (3) `fact_labor_month` - granular labor costs per person/project/period with 3-hour types (target, asana, billing), ANTI×100 normalization (hours >500 → /100, costs >1M → /100), and audit flags; (4) `fact_rc_month` - aggregated revenue/costs from "Rendimiento Cliente" sheet with ARS/USD columns and FX rates; (5) `agg_project_month` - pre-computed KPIs (markup, margin, budget utilization) per project/period for fast dashboard queries (99 aggregates across 9 periods and 11 projects for 2025). ETL orchestrator (`executeSoTETL`) accepts configurable `SoTETLOptions` with: `scopes.periods` array for incremental/windowed execution, `dryRun` mode for validation, and `recomputeAgg` flag for aggregate refresh. Reads both Excel sheets, applies fuzzy project matching (client+project name), enforces mathematical invariants, and populates all layers atomically. Includes intelligent currency detection heuristic, composite indexes for performance, and comprehensive observability via flags/logging. Accessible via `/api/etl/sot/run` endpoint with POST body for scopes. **Automated Validation System**: `/api/etl/sot/validate` endpoint executes 5 critical checks: (1) missing rates detection, (2) ANTI×100 violations (hours >500 or costs >1M), (3) currency inconsistencies (ARS==USD or USD>100K), (4) mathematical invariant violations (aggregate sums vs fact sums), (5) orphaned labor records. **Daily Synchronization Job**: Cronjob scheduled at 02:00 America/Argentina/Buenos_Aires using `node-cron`, executes incremental ETL for current month with aggregate recomputation, registered in server startup. Designed for backward compatibility and gradual migration from legacy dual-table system. **Historical Data Scope**: Excel MAESTRO contains data for 2025-01 to 2025-09 only; no 2023-2024 historical records available in source.
- **Time Tracking SoT Migration (Oct 2025)**: Fixed critical data visibility issue where `/api/projects/:id/time-tracking` endpoint only showed 1 team member instead of all 6 due to outdated legacy data in `project_aggregates`. Solution: endpoint now queries `fact_labor_month` (Star Schema SoT) directly as primary source with intelligent fallback to legacy aggregates when SoT data unavailable. Includes safe number parsing (`safeNum()`) to handle nulls and maintains full API contract compatibility. All team members now display correctly with data sourced from Excel MAESTRO via SoT pipeline.
- **SoT ETL Enhancements (Oct 2025)**: (1) **Budget Utilization Corrected**: `budget_utilization = cost / price_native` where `price_native` is monthly fee from "Rendimiento Cliente" (NOT hours/hours which is efficiency metric). (2) **6-Level Rate Fallback**: Excel → Catalog Project → Catalog General → Historical → Role Baseline → RC Reconciliation, with flags tracking source (`rate_from_excel`, `rate_from_catalog_project`, etc.). (3) **Relational ANTI×100 Guard for Costs**: Replaces absolute threshold (>1M) with intelligent detection: if `cost_raw / (rate × hours) ∈ [90,110]` then `cost = cost_raw / 100`, preventing false positives and catching edge cases. (4) **FX Fallback**: When labor sheet lacks FX, automatically sources from `fact_rc_month[projectId, periodKey]`, persists fallback value to `fact_labor_month.fx`, and flags with `fallback_fx` for audit trail. All transformations tracked via comprehensive flags in `fact_labor_month.flags` JSONB field.

### System Design Choices
- **Unified Data Source**: Centralized data fetching with temporal filtering.
- **Modular Design**: Separation of concerns for scalable development.
- **Optimistic UI Updates**: Instant feedback for user actions.
- **Robust Validation**: Extensive use of Zod for data integrity.
- **Security**: Session-based authentication, input sanitization, file upload restrictions, and role-based access control.
- **Financial Coherence**: Consistent application of business logic for financial calculations.
- **Dynamic Content**: Elimination of hardcoded values, relying on dynamic data integration.
- **Performance Optimization**: Advanced React Query caching, optimized database indices, and reduced polling.
- **Unified ViewModel Pattern**: Ensures consistent cost and revenue display across all project detail cards by using a single selector that consumes backend-provided native currency values.

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
- **node-cron**: For scheduled task automation (daily SoT ETL synchronization).