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
- **Team Breakdown System**: ETL processes Excel MAESTRO "Costos directos e indirectos" sheet to build comprehensive team breakdown data with person+role grouping. Includes intelligent hours fallback (horasParaFacturacion → horasRealesAsana → targetHours), cost tracking (ARS/USD), and validation flags. Data exposed via `projectVM.teamBreakdown` for consistent display across Dashboard and Team tabs.

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