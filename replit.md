# Project Management & Social Listening Platform

## Overview

This is a comprehensive internal project management platform built for Epical Digital, designed to handle quotations, active project tracking, time entries, client communication, and social listening analysis. The application provides a complete workflow from initial client quotations through project execution and completion.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with custom Tailwind CSS styling
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with express-session
- **File Uploads**: Multer for handling file uploads (client logos, etc.)
- **Real-time Communication**: WebSocket implementation for chat functionality

### Database Architecture
- **Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit for migrations
- **Connection Pooling**: Neon serverless connection pooling

## Key Components

### Core Modules
1. **User Management**: Authentication system with role-based access
2. **Client Management**: Client information, contacts, and logo management
3. **Quotation System**: Comprehensive quotation creation with team assignments and cost multipliers
4. **Project Management**: Active project tracking with subproject support
5. **Time Tracking**: Time entry system supporting both hourly and cost-based entries
6. **Deliverable Management**: MODO-style deliverable tracking with quality metrics
7. **Chat System**: Internal communication with project-based conversations
8. **Analytics Dashboard**: Executive and operational dashboards

### Business Logic Components
- **Cost Calculation Engine**: Handles complex pricing calculations with multipliers
- **Template System**: Role assignments and recurring project templates
- **Quality Metrics**: Comprehensive scoring system for deliverable quality
- **Inflation Management**: Monthly inflation tracking for cost adjustments

## Data Flow

### Quotation to Project Flow
1. Create quotation with client details and team assignments
2. Apply cost multipliers based on project complexity
3. Approve quotation to automatically generate active project
4. Track project progress through deliverables and time entries
5. Generate reports and analytics for client communication

### Time Tracking Flow
1. Personnel log time entries against specific projects
2. Support for both hourly tracking and direct cost entry
3. Integration with quotation budgets for cost monitoring
4. Real-time budget vs. actual cost analysis

### Quality Management Flow
1. Create deliverables for active projects
2. Track quality metrics (narrative quality, graphics effectiveness, etc.)
3. Record client feedback and operational feedback
4. Generate quality reports for continuous improvement

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless database connection
- **drizzle-orm**: Type-safe database ORM
- **express**: Web application framework
- **react**: Frontend framework
- **@tanstack/react-query**: Server state management
- **zod**: Runtime type validation
- **@radix-ui/***: Accessible UI component primitives

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **tailwindcss**: Utility-first CSS framework
- **drizzle-kit**: Database schema management and migrations

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with hot reloading via Vite
- **Production**: Built with Vite and served through Express static middleware
- **Database**: Neon PostgreSQL with environment-based connection strings

### Build Process
1. Frontend build: `vite build` outputs to `dist/public`
2. Backend build: `esbuild` bundles server code to `dist/index.js`
3. Database migrations: `drizzle-kit push` for schema updates

### Security Measures
- Session-based authentication with PostgreSQL session store
- Input sanitization middleware for XSS and SQL injection prevention
- File upload restrictions and validation
- Role-based access control for sensitive operations

## Recent Changes

- July 14, 2025: **TEAM ACTIONS FUNCTIONALITY** - Implemented full functionality for team management buttons: Historial Completo (navigates to time-entries), Configurar Equipo (opens time registration), and Generar Reportes (exports team data as CSV)
- July 14, 2025: **FINANCIAL ANALYSIS ENHANCEMENT** - Added dedicated "Análisis de Rentabilidad" section with markup calculation, price vs cost breakdown, and budget efficiency metrics providing key financial insights not available in header cards
- July 14, 2025: **UX CONSOLIDATION - ELIMINATED REDUNDANT INDICATORS SECTION** - Removed duplicate "Indicadores Clave" section within dashboard tab as it showed identical information to header cards, improving UI clarity and reducing cognitive load
- July 14, 2025: **CRITICAL TEMPORAL FILTERING SYSTEM FIXES** - Fixed missing dateFilter dependencies in recentTimeEntries, teamStats, and ProjectTeamSection components ensuring all 3 tabs update correctly when date filter changes
- July 14, 2025: **MARKUP CALCULATION CONSOLIDATION** - Unified markup calculation logic across executive summary and monthly analysis using consistent targetClientPrice/actualCost formula
- July 14, 2025: **COMPREHENSIVE UX/UI AUDIT AND REDESIGN** - Conducted complete user experience audit and eliminated all redundant components
- July 14, 2025: **PROFESSIONAL INTERFACE CONSOLIDATION** - Restructured project details with clean 3-section KPI layout eliminating visual overload
- July 14, 2025: **MARKUP DISPLAY OPTIMIZATION** - Consolidated markup calculations into single source of truth with prominent visual hierarchy
- July 14, 2025: **NAVIGATION CONSISTENCY IMPROVEMENTS** - Eliminated duplicate "Registrar Tiempo" buttons and streamlined team management actions
- July 14, 2025: **INFORMATION ARCHITECTURE ENHANCEMENT** - Reorganized cards with clear color-coded borders and professional spacing
- July 14, 2025: **VISUAL HIERARCHY OPTIMIZATION** - Implemented progressive disclosure with primary metrics (markup) getting visual priority
- July 14, 2025: **COMPONENT DEDUPLICATION** - Removed redundant markup analysis sections that confused users with duplicate information
- July 14, 2025: **PROFESSIONAL STYLING CONSISTENCY** - Applied consistent gradient backgrounds, proper spacing, and professional typography
- July 14, 2025: **ENHANCED DEVIATION ANALYSIS** - Created consolidated deviation comparison with clear financial, temporal, and projection metrics
- July 14, 2025: **STREAMLINED TEAM ACTIONS** - Replaced cluttered action buttons with descriptive, single-purpose navigation elements
- July 11, 2025: **MAJOR UX REDESIGN - ELIMINATED REDUNDANT COMPONENTS** - Completely restructured project details view with professional 3-tab interface
- July 11, 2025: Created consolidated analytics system: "Resumen Ejecutivo", "Gestión del Equipo", and "Análisis Mensual" eliminating all redundancies
- July 11, 2025: Implemented comprehensive markup calculation card with dynamic filtering that respects selected date ranges  
- July 11, 2025: **CRITICAL MARKUP LOGIC CORRECTION** - Fixed markup calculation to use quotation price instead of budget (Price/Cost) as source of truth
- July 11, 2025: Added comprehensive comparison section showing real vs estimated costs, hours, and price from approved quotation
- July 11, 2025: Implemented deviation percentages with color coding (red for over, green for under estimates)
- July 11, 2025: Added detailed markup analysis with profit calculations, budget utilization progress, and projected final markup
- July 11, 2025: Enhanced markup quality thresholds: Excelente (2.5x+), Bueno (1.8x+), Aceptable (1.2x+), Crítico (<1.2x)
- July 11, 2025: Enhanced executive summary with 4-metric KPI cards including real-time markup percentage
- July 11, 2025: Removed all duplicate hour tracking components across tabs (Gestión de Tiempo, Distribución de Horas, Actividad del Proyecto redundancies)
- July 11, 2025: Enhanced professional interface with consistent data calculations and comprehensive monthly filtering functionality
- July 11, 2025: Fixed critical "TypeError: illegal constructor" error by adding missing History icon import from lucide-react
- July 11, 2025: Enhanced Date constructor validation throughout project components to prevent runtime errors
- July 11, 2025: **UNIVERSAL TEMPORAL FILTERING SYSTEM** - Implemented generic date filter options for ANY project using system sources of truth
- July 11, 2025: Created universal filter options: "Este mes", "Mes pasado", "Este trimestre", "Trimestre pasado", "Este semestre", "Semestre pasado", "Total año", "Fecha personalizada"
- July 11, 2025: **CRITICAL BUSINESS LOGIC IMPLEMENTATION** - Added differentiated calculation logic for Always-On vs One-Shot projects using quotationData.projectType as source of truth
- July 11, 2025: Always-On projects (projectType='always-on') multiply objectives by selected time period, One-Shot projects always use total quotation values regardless of filter
- July 11, 2025: **COMPLETE DYNAMIC DATA INTEGRATION** - Eliminated all hardcoded values and implemented universal dynamic quotation data system
- July 11, 2025: Backend now calculates estimated hours dynamically from quotation team members for any project (e.g., 969 hours for project 26)
- July 11, 2025: All project details components now use real quotation data: baseCost, totalAmount, estimatedHours from associated approved quotations
- July 11, 2025: Comprehensive filtering system works universally across all tabs (Dashboard, Team, Operations, Analytics) with proper period multipliers
- July 11, 2025: Fixed budget calculations in all sections to use dynamic "budget" field instead of deprecated "totalBudget" references
- July 11, 2025: Verified system compatibility for any project by fetching associated quotation data and calculating objectives dynamically
- July 10, 2025: **MAJOR SYSTEM ARCHITECTURE CONSOLIDATION** - Eliminated confusing navigation structure and duplicate analytics pages
- July 10, 2025: Created consolidated analytics page (`analytics-consolidated.tsx`) that replaces fragmented analytics sections
- July 10, 2025: Simplified navigation sidebar with clearer titles and descriptions (e.g., "Analytics & Reportes" instead of multiple confusing sections)
- July 10, 2025: Cleaned up App.tsx routing structure with organized sections and legacy redirects
- July 10, 2025: Fixed duplicate pages issue by establishing single source of truth for each functionality
- July 10, 2025: **MAJOR MONTHLY FILTERING IMPLEMENTATION** - Applied comprehensive monthly filtering for Always-On contracts across all project views
- July 10, 2025: Updated active projects summary KPI cards to show monthly metrics for Always-On contracts instead of accumulated totals
- July 10, 2025: Modified project details view to apply monthly filtering for team statistics and time entries
- July 10, 2025: Enhanced budget calculations to show monthly budget for Always-On projects vs total budget for unique projects
- July 10, 2025: Implemented intelligent time tracking filtering: monthly view for Always-On contracts, total view for unique projects
- July 4, 2025: **MAJOR FUNCTIONALITY OVERHAUL** - Replaced QuickTimeRegister with WeeklyTimeRegister component for simplified weekly time tracking
- July 4, 2025: Removed unnecessary real-time tracking functionality and play/pause features per user request
- July 4, 2025: Created streamlined two-step process: period configuration and team hour registration
- July 4, 2025: Fixed team member data retrieval to show all 14 team members instead of hardcoded mock data
- July 4, 2025: **MAJOR UX ENHANCEMENT** - Completely redesigned QuickTimeRegister component with modern, user-friendly interface
- July 4, 2025: Implemented historical hourly rate functionality for accurate cost tracking of previous months
- July 4, 2025: Added editable tariff fields with visual indicators for historical vs current rates
- July 4, 2025: Enhanced UI with gradient backgrounds, improved typography, and intuitive card-based layout
- July 4, 2025: Added avatar initials, better spacing, and professional color scheme throughout time registration
- July 4, 2025: Implemented smart cost calculation with automatic updates based on custom hourly rates
- July 4, 2025: Enhanced form validation and user feedback with clear visual states and indicators
- July 3, 2025: **MAJOR UX IMPROVEMENT** - Completely removed ugly browser popup for draft restoration
- July 3, 2025: Implemented elegant banner-style draft restoration with subtle user interface
- July 3, 2025: Added intelligent draft detection that only shows restore options when last quotation wasn't completed successfully
- July 2, 2025: Implemented automatic team copying from quotation when creating projects from approved quotations
- July 2, 2025: Enhanced project team section to show both estimated and actual worked hours per team member  
- July 2, 2025: Added progress bars and completion percentages for individual team members and overall project
- July 2, 2025: Integrated real-time time tracking visualization in the team tab showing cost comparisons
- June 30, 2025: Implemented complete password recovery functionality with "Forgot Password" feature
- June 30, 2025: Added password reset tokens database table and API endpoints for secure password recovery
- June 30, 2025: Created new authentication tab for password recovery with two-step process (email → token → new password)
- June 30, 2025: Enhanced authentication system with secure token generation and validation
- June 26, 2025: Implemented complete real-time admin panel functionality with optimistic cache updates
- June 26, 2025: Added optional email column to personnel database table with validation updates
- June 26, 2025: Fixed exchange rate updates in inflation tab to show immediate visual feedback
- June 26, 2025: Enhanced role creation and editing with instant appearance in lists
- June 26, 2025: Fixed admin panel real-time updates for both roles and personnel hourly rates
- June 26, 2025: Corrected HTTP method mismatch from PUT to PATCH for role and personnel updates 
- June 26, 2025: Enhanced admin panel styling with consistent typography and professional edit interface
- June 26, 2025: Added spinner animations and immediate visual feedback for admin panel updates
- June 24, 2025: Fixed critical Select component crashes when adding team members
- June 24, 2025: Updated "Agregar Miembro Completo" button to more professional "Configurar Miembro"
- June 23, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.