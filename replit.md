# Project Management & Social Listening Platform

## Overview
This platform is a comprehensive internal project management system for Epical Digital, covering the entire workflow from quotation generation to project execution and social listening analysis. Its primary purpose is to streamline project management, facilitate client and internal communication, and provide in-depth analytics for business decision-making. The system aims to enhance efficiency, transparency, and profitability in project delivery, offering capabilities for quotation management, project tracking, time entry, deliverable management, and robust financial and operational analytics.

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

#### **Navigation Structure (Reorganized Aug 2025):**
- **Principal**: Dashboard Ejecutivo
- **Gestión Comercial**: Nueva Cotización, Cotizaciones, Clientes
- **Gestión Operacional**: Proyectos Activos
- **Análisis Financiero**: Resumen Financiero, Analytics & Reportes, Costos Indirectos
- **Herramientas**: Excel MAESTRO, Configuración

#### **Core Features:**
- **User Management**: Role-based access control.
- **Client Management**: Client information, logo handling, and Google Sheets integration for automated client import.
- **Quotation System**: Comprehensive quotation creation with team assignment and cost multipliers.
- **Project Management**: Active project and subproject tracking with integrated financial management.
- **Financial Management System**: Dual-purpose analysis separating operational sales (monthly revenue recognition) from financial transactions (real invoicing/collection tracking). Project-level financial management accessible via dedicated page (no internal tabs duplication).
- **Time Tracking**: Hourly and cost-based time entry.
- **Deliverable Management**: MODO-style tracking with quality metrics.
- **Chat System**: Project-based internal communication.
- **Analytics Dashboard**: Executive and operational dashboards with KPIs, financial analysis (ROI, profit margin, cost efficiency), and predictive insights.
- **Financial Overview**: Consolidated financial dashboard with operational vs financial analysis comparison.
- **Google Sheets Integration**: Automated client import from "Activo" tab (column C) with duplicate prevention and batch processing. Complete Excel MAESTRO synchronization service with automatic imports from "Ventas Tomi" sheet every 30 minutes.
- **Business Logic**: Cost calculation engine, template system, quality metrics, and inflation management.
- **Workflow**: Automated quotation-to-project conversion, time tracking integration with budgets, and quality management.
- **UI/UX Decisions**: Emphasis on clean, professional interfaces with consistent color schemes, intuitive layouts, and responsive design. Features like dynamic color indicators, clear typography, and enhanced visual hierarchies are implemented across dashboards and forms. Advanced features include a professional business intelligence dashboard, detailed financial analysis, and prediction/recommendation systems.

### System Design Choices
- **Unified Data Source**: Centralized data fetching (`/api/projects/:id/complete-data`) with temporal filtering for consistency across all modules.
- **Modular Design**: Separation of concerns into distinct frontend and backend services, allowing for scalable development.
- **Optimistic UI Updates**: Instant feedback for user actions (e.g., time entry, admin panel updates) to improve perceived performance.
- **Robust Validation**: Extensive use of Zod for schema validation across the application to ensure data integrity.
- **Security**: Session-based authentication, input sanitization, file upload restrictions, and role-based access control.
- **Financial Coherence**: Consistent application of business logic for markup, cost, and profit calculations across all reports and dashboards, including inflation and indirect costs.
- **Dynamic Content**: Elimination of hardcoded values, relying on dynamic data integration from approved quotations.
- **Dual-Cost System**: Complete implementation of real costs (actual cash outflow from freelancers) vs operational costs (total team productivity analysis). Full-time employees with fixed salaries generate only operational costs, while part-time/freelance workers generate both types. System verified as 100% mathematically consistent across all components (Aug 2025).
- **Performance Optimization**: Advanced React Query caching strategies with intelligent stale times, optimized database indices, and elimination of excessive polling. Database integrity verified at 100% with zero orphaned records (Aug 2025).

## Recent Implementation (Sep 2025)
- **Corrección Completa de Costos Directos - RESUELTA (Sep 1, 2025)**: Sistema completamente corregido para importar múltiples registros por proyecto:
  - **Problema Identificado**: Solo se importaba 1 persona por proyecto (ej: Solo Sol Ayala para Huggies) cuando debían ser 8+ personas
  - **Causa Raíz**: Filtro rechazaba registros sin tarifas horarias definidas, aunque tuvieran montos USD válidos
  - **Solución Implementada**: 
    - Lógica híbrida: Usar tarifas horarias cuando disponibles, montos USD directos cuando no
    - Procesamiento de todos los registros válidos del Excel MAESTRO
    - Mantener integridad usando valores pre-convertidos a USD (columna R)
  - **Resultado Verificado**: Fee Huggies junio 2025 ahora muestra 8 personas (vs 1 anterior): Aylu Tamer, Mati Gonzalez, Sol Ayala, To Merello, Tomi Facio, Trini Petreigne, Vanu Lanza, Vicky Achabal
  - **Impacto**: 242 registros nuevos importados correctamente en primera sincronización post-corrección
  - **Filtrado Crítico**: Solo procesar filas con tipo "DIRECTO" (columna E)
  - **Mapeo Corregido**: Cliente (col J) + Proyecto (col I) para identificación correcta
  - **Estructura Temporal**: Cada fila representa un mes de trabajo de una persona específica
  - **Sincronización Automática**: Integrada con ciclo de 30 minutos para mantener datos actualizados

## Previous Implementation (Aug 2025)
- **Automatic Excel MAESTRO Synchronization**: Implemented complete background service that synchronizes sales data from "Ventas Tomi" sheet every 30 minutes. Features include:
  - AutoSyncService with configurable intervals
  - Duplicate detection and automatic updates
  - Real-time monitoring dashboard in Excel MAESTRO page
  - Manual synchronization triggers
  - Complete error handling and logging
  - Automatic server startup initialization
- **Sales Data Management**: Complete CRUD operations for Google Sheets sales import with proper data validation and temporal filtering.
- **Monitoring Interface**: Real-time status monitoring for synchronization services with live updates every 30 seconds.
- **Conditional Financial Logic (Aug 29, 2025)**: Implemented dual financial analysis system based on project creation date:
  - **Legacy Projects** (pre-Sept 2025): Use real income data from Google Sheets vs actual costs for markup calculations
  - **Future Projects** (post-Sept 2025): Use approved quotation pricing vs actual costs for markup calculations
  - Dynamic dashboard labels and tooltips that adjust based on project type
  - Seamless transition logic ensuring accuracy for both historical and forward-looking analysis
- **Temporal Data Differentiation (Aug 29, 2025)**: Enhanced dashboard to distinguish real worked data from projected data:
  - **Real Data**: Sales with status "completada" (past) + "activa" (current) for authentic revenue calculations
  - **Projected Data**: Sales with status "proyectada" (future) displayed separately for planning purposes
  - **Dashboard Cards**: Markup calculations use only real income vs actual costs, ensuring accurate performance metrics
  - **New Card**: Added dedicated "Ingresos Proyectados" card to clearly separate estimates from actuals
  - **Financial Coherence**: All metrics now properly differentiate between worked periods and projected periods

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
```