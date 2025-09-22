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
- **Business Logic**: Cost calculation engine, template system, quality metrics, and inflation management.
- **Workflow**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **Dual-Cost System**: Differentiates between real costs (cash outflow) and operational costs (team productivity analysis).
- **Advanced Temporal Filtering**: Supports standard periods (quarters, months, years), custom date ranges, and relative periods.
- **Architectural Redesign of "Proyectos Activos"**: Implemented a comprehensive blueprint with a single source of truth architecture, a unified backend aggregator (`server/domain/projectsActive.ts`), and a rewritten frontend (`client/src/pages/active-projects-v2.tsx`) using unified contracts. This ensures mathematical invariants for portfolio summaries.
- **Unified Data Source**: All project-related data is now sourced exclusively from the Excel MAESTRO, consolidating sales and cost data.

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