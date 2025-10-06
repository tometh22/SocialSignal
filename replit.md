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
- **Single Source of Truth (SoT) Architecture**: Dual-table cache system (`income_sot`, `costs_sot`) stores pre-aggregated KPIs indexed by `(project_key, month_key)`. ProjectKey format: `canonicalizeKey(clientName|projectName)` produces lowercase, trimmed strings with preserved spaces and special characters (e.g., `"warner|fee marketing"`, `"play digital s.a (modo)|fee mensual"`). System ensures mathematical parity between list view (`/api/projects`) and detail view (`/api/projects/:id/complete-data`) by using identical SoT queries. When SoT tables are empty, automatic fallback to ActiveProjectsAggregator ensures zero downtime. August 2025 backfill verified golden values: Warner Fee Marketing $29,230 revenue / $7,005.20 cost = 76% margin.
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