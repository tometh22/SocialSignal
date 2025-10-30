# Project Management & Social Listening Platform

## Overview
This platform is an internal project management system for Epical Digital, designed to streamline project workflows from quotation to execution and social listening analysis. It aims to enhance efficiency, transparency, and profitability by providing tools for quotation management, project tracking, time entry, deliverable management, and robust financial and operational analytics. The system features a comprehensive business intelligence dashboard, detailed financial analysis, and prediction/recommendation capabilities, focusing on integrating with existing Google Sheets workflows.

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
- **UI/UX Decisions**: Emphasizes clean, professional interfaces with consistent color schemes, intuitive layouts, responsive design, dynamic color indicators, clear typography, and enhanced visual hierarchies.

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
- **Analytics Dashboard**: Executive and operational dashboards with KPIs, financial analysis (ROI, profit margin, cost efficiency), and predictive insights.
- **Google Sheets Integration**: Automated client import and complete Excel MAESTRO synchronization service, including automatic imports from "Ventas Tomi" and "Rendimiento Cliente" sheets.
- **Universal ETL System "Líneas Generales"**: Flexible data processing with ARS/USD currency handling, intelligent field preferences, automatic format detection, and anti-×100 pattern correction, synchronizing every 30 minutes.
- **Temporal Consistency Guard (TCG)**: Anomaly detection and autocorrection system for costs, preventing data corruption using configurable thresholds and temporal baselines.
- **Business Logic**: Cost calculation engine, template system, quality metrics, and inflation management.
- **Workflow Automation**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **Dual-Cost System**: Differentiates between real costs (cash outflow) and operational costs (team productivity analysis).
- **Advanced Temporal Filtering**: Supports standard periods, custom date ranges, and relative periods.
- **Architectural Redesign of "Proyectos Activos"**: Single source of truth architecture with a unified backend aggregator and rewritten frontend for mathematical invariants in portfolio summaries.
- **Single Source of Truth (SoT) Architecture**: Unified `financial_sot` table sourcing project data exclusively from "Rendimiento Cliente" Google Sheets, with native currency display logic and normalized USD values for KPIs via a robust ETL pipeline.
- **Intelligent Project Visibility System**: Advanced logic for Active Projects page with smart filtering, per-card view toggles, and "Mark as finished" functionality.
- **Multi-Currency 3-View System Architecture**: Provides "Original", "Operativa" (native currency), and "USD Consolidada" (USD for company-wide analysis) perspectives, with data pre-computed in `project_aggregates`.
- **Team Breakdown System (3-Hours Architecture)**: ETL processes Excel MAESTRO "Costos directos e indirectos" for `targetHours`, `hoursAsana` (actual tracked hours with ANTI_×100 normalization), and `hoursBilling` (hours for billing with intelligent fallback). Data exposed via `projectVM.teamBreakdown`.
- **Star Schema SoT ETL Pipeline**: Data warehouse architecture with `dim_period`, `dim_person_rate`, `fact_labor_month`, `fact_rc_month`, and `agg_project_month` tables for robust analytics and KPIs. Includes automated validation and daily synchronization.
- **Time Tracking SoT Migration**: Critical data visibility fix where `/api/projects/:id/time-tracking` endpoint now queries `fact_labor_month` (Star Schema SoT) directly with intelligent fallback.
- **Operational Metrics SoT Migration (Oct 2025)**: Migrated `/api/projects/:id/operational-metrics` endpoint from legacy `time_entries` table (empty) to Star Schema `fact_labor_month` as single source of truth. All WIP/Lead Time/Throughput calculations now use `asana_hours` from Star Schema with proper Drizzle ORM query builder.
- **SoT ETL Enhancements**: Corrected budget utilization, 6-level rate fallback logic, relational ANTI×100 guard for costs, and FX fallback. Semantic separation of FX rate vs Project Quotation for accurate `quote_native` and `fx_rate` values.
- **Deterministic + Fuzzy Project Resolver V2**: 3-stage cascade resolution for project matching using `dim_client_alias` and `dim_project_alias`, with `rc_unmatched_staging` for auditing unmatched rows. System learns from Excel data automatically.
- **Foreign Key Constraint Fix (Oct 2025)**: Corrected `dim_client_alias` and `dim_project_alias` foreign key constraints to reference `clients.id` instead of `activeProjects.id`, enabling proper RC ETL processing for all periods without violations.
- **One-Shot Project Visualization System (Oct 2025)**: Dual-view system for one-shot projects with single revenue entry but multi-month cost distribution. Features intelligent period visibility where projects appear in any period with costs, automatically showing lifetime revenue aggregated from all periods. Core logic uses revenue-only guard in `addOneShotProjectsLifetime()` to prevent double-counting when period revenue exists. Includes contextual alerts via `OneShotBanner` when viewing periods without revenue, lifetime metrics aggregation via `/api/projects/:id/lifetime-metrics` endpoint, and visual badges in project lists. Detects one-shot projects using `quotations.quotationType` field ('one-time' | 'recurring' | 'fee').

### System Design Choices
- **Unified Data Source**: Centralized data fetching with temporal filtering.
- **Modular Design**: Separation of concerns for scalable development.
- **Optimistic UI Updates**: Instant feedback for user actions.
- **Robust Validation**: Extensive use of Zod for data integrity.
- **Security**: Session-based authentication, input sanitization, file upload restrictions, and role-based access control.
- **Financial Coherence**: Consistent application of business logic for financial calculations.
- **Dynamic Content**: Elimination of hardcoded values, relying on dynamic data integration.
- **Performance Optimization**: Advanced React Query caching, optimized database indices, and reduced polling.
- **Unified ViewModel Pattern**: Ensures consistent cost and revenue display across all project detail cards.

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
- **fuse.js**: For fuzzy string matching in project resolver.