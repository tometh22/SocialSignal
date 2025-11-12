# Project Management & Social Listening Platform

## Overview
This platform is an internal project management system for Epical Digital, designed to streamline project workflows from quotation to execution and social listening analysis. It aims to enhance efficiency, transparency, and profitability by providing tools for quotation management, project tracking, time entry, deliverable management, and robust financial and operational analytics. The system features a comprehensive business intelligence dashboard, detailed financial analysis, and prediction/recommendation capabilities, focusing on integrating with existing Google Sheets workflows. The business vision is to provide a unified platform for project, financial, and operational management, offering clear insights into profitability and team performance.

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
- **UI/UX Decisions**: Clean, professional interfaces with consistent color schemes (simplified to green/red/gray for status), intuitive layouts, responsive design, dynamic color indicators, clear typography, and enhanced visual hierarchies.

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
- **Google Sheets Integration**: Automated client import and complete Excel MAESTRO synchronization, including automatic imports from "Ventas Tomi" and "Rendimiento Cliente" sheets.
- **Universal ETL System "Líneas Generales"**: Flexible data processing with ARS/USD currency handling, intelligent field preferences, automatic format detection, and anti-×100 pattern correction, synchronizing every 30 minutes.
- **Temporal Consistency Guard (TCG)**: Anomaly detection and autocorrection system for costs using configurable thresholds and temporal baselines.
- **Business Logic**: Cost calculation engine, template system, quality metrics, and inflation management.
- **Workflow Automation**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **Dual-Cost System**: Differentiates between real costs (cash outflow) and operational costs (team productivity analysis).
- **Advanced Temporal Filtering**: Comprehensive multi-period temporal filtering system with support for month, bimonth, quarter, semester, year, and custom date ranges (via `server/services/temporal-filter.ts`). Executive Dashboard supports flexible time-range analytics via `PeriodSelector` component with automatic period resolution and indexed database queries using `WHERE period_key = ANY($1)`.
- **Single Source of Truth (SoT) Architecture**: Unified `financial_sot` table sourcing project data exclusively from "Rendimiento Cliente" Google Sheets, with native currency display and normalized USD values via a robust ETL pipeline. Star Schema for analytics (`dim_period`, `dim_person_rate`, `fact_labor_month`, `fact_rc_month`, `agg_project_month`).
- **Multi-Currency 3-View System Architecture**: Provides "Original", "Operativa" (native currency), and "USD Consolidada" (USD for company-wide analysis) perspectives, with pre-computed data in `project_aggregates`.
- **Team Breakdown System**: ETL processes Excel MAESTRO "Costos directos e indirectos" for `targetHours`, `hoursAsana`, and `hoursBilling`.
- **Deterministic + Fuzzy Project Resolver V2**: 3-stage cascade resolution for project matching using `dim_client_alias` and `dim_project_alias`.
- **One-Shot Project Visualization System**: Dual-view system for one-shot projects with single revenue entry but multi-month cost distribution, featuring intelligent period visibility and lifetime metrics aggregation.
- **Executive Dashboard Enhancements**: Separation of billed revenue and Work-In-Progress (WIP), showing both actual and projected margins, and integration of intelligent, context-aware business intelligence alerts (e.g., `NO_BILLING_WITH_COSTS`, `BILLABLE_DROP`, `FX_SHIFT`, `OVER_BURN`).

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