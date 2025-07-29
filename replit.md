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

- July 29, 2025: **VISTA GENERAL TAB COMPLETELY REDESIGNED FOR PROFESSIONAL BUSINESS INTELLIGENCE** - Replaced generic Vista General tab with meaningful executive dashboard: new 3-section Resumen Ejecutivo with actionable financial/operational/pipeline metrics, redesigned portfolio visualization showing monetary values instead of just project counts, simplified financial trends chart focusing on revenue vs costs, new Panel de Control Ejecutivo with 4 visual health indicators (Estado General, Proyectos en Riesgo, Burn Rate, Capacidad Utilizada) using dynamic color coding, eliminated redundant generic metrics in favor of specific business insights like net profit, productivity per hour, conversion rates, and Q3 projections, all data now tells a clear story about business health supporting executive decision-making
- July 29, 2025: **COMPLETE 4-TAB ANALYTICS STRUCTURE IMPLEMENTED** - Reorganized "Salud Corporativa" section into perfectly balanced 4-tab structure based on user feedback: "Vista General" (executive overview with portfolio distribution and trends), "Análisis de Proyectos" (detailed project efficiency table, top performers, hours distribution, and cost analysis), "Salud Financiera" (comprehensive financial health with personnel costs, KPI cards, and corporate health indicators), "Insights y Recomendaciones" (business intelligence with alerts center, strengths/opportunities analysis, and strategic recommendations), each tab now has 3-4 major components ensuring balanced content distribution, maintains all existing functionality while providing clearer navigation and better user experience
- July 29, 2025: **ANALYTICS SECTION RENAMED TO "SALUD CORPORATIVA"** - Complete reorganization of analytics section: renamed from "Estadísticas y Análisis" to "Salud Corporativa" in sidebar navigation, restructured into 3 coherent tabs without duplications (Resumen Ejecutivo, Análisis Operacional, Salud Financiera), moved Personnel Cost Analysis section into Financial tab for better hierarchy, eliminated all redundant components and orphaned sections, maintained all functionality while improving information architecture, provides clearer business intelligence focused on corporate health metrics rather than generic analytics
- July 29, 2025: **DUAL ANALYSIS SYSTEM FOR CORPORATE HEALTH** - Integrated personnel cost analysis into "Salud Corporativa" tab showing real corporate costs: system now distinguishes between fixed monthly costs (full-time employees with salaries) vs variable costs (part-time/freelancers paid by hours), added "Análisis de Costos de Personal" section with three key metrics (Fixed Monthly Costs, Variable Costs, Global Efficiency), updated all main KPI calculations (EBITDA, Cash Flow, Burn Rate) to use real costs (fixed + variable) instead of just project hours, added visual indicators showing calculations use "Costos reales", comprehensive tooltips explain the dual analysis system that enables proper corporate health analysis vs individual project profitability
- July 28, 2025: **INDIRECT COSTS PAGE PERFORMANCE OPTIMIZATION** - Major performance improvements to address slow loading times: implemented lazy loading with React Query's `enabled` flag to load data only when needed, added React.useMemo for expensive calculations to prevent unnecessary re-computation, created optimized loading skeleton with animated placeholders for better perceived performance, fixed double JSON.stringify bug in all API mutations that was causing request failures, optimized queries to load only essential data on initial render (categories first, then costs/hours based on selected tab), reduced initial page load time significantly by deferring non-critical data fetching
- July 28, 2025: **CORPORATE HEALTH METRICS DASHBOARD TRANSFORMATION** - Complete overhaul of analytics dashboard replacing generic metrics with meaningful corporate health indicators: implemented "Cash Flow Operativo" showing liquidity, "EBITDA" with margin percentage, "Burn Rate" for monthly spending control, "Pipeline Value" tracking sales opportunities, "Utilización" for team capacity metrics, added new "Salud Corporativa" tab with 4 health status indicators (Financial Health, Expense Control, Commercial Pipeline, Productivity), actionable business insights showing strengths and improvement areas, comprehensive cash flow projections for 90 days with strategic recommendations, all metrics now provide real operational value for business decision-making instead of vanity metrics
- July 28, 2025: **ANALYTICS DASHBOARD UNIFIED TEMPORAL FILTERING** - Major reorganization to eliminate duplicate UI elements: implemented single temporal filter matching time-entries component with comprehensive date options (months, quarters, semesters, year), removed duplicate control panels, added 5-column KPI layout with new "Ganancia Neta" (net profit) card showing revenue minus costs, renamed "Revenue Total" to "Facturación Total" for Spanish consistency, enhanced revenue calculations to properly track client prices from quotations, updated monthly trends to calculate accurate revenue per month based on project activity, maintains mathematical coherence across all temporal filters
- July 28, 2025: **PROFESSIONAL BUSINESS INTELLIGENCE DASHBOARD IMPLEMENTED** - Complete redesign of analytics dashboard with corporate-level features: renamed to "Business Intelligence Dashboard", added real-time KPI header cards with growth indicators and trend analysis, implemented advanced control center with multiple filter options (period, client, metric type, project type), integrated professional charts using Recharts library (pie charts for portfolio distribution, area charts for revenue trends, bar charts for efficiency analysis), added performance matrix showing efficiency vs profitability for all projects, created comprehensive insights system with actionable intelligence cards, enhanced performance tab with ROI metrics and top performers ranking, fully responsive design suitable for executive presentations and deep corporate analysis
- July 28, 2025: **PROPOSAL LINK IN ORIGINAL QUOTATIONS** - Extended proposal link functionality to original quotations: added `proposalLink` field to quotations table schema, integrated proposalLink into QuotationData interface and context, enhanced ReviewFinalFormat component with proposal link input field in final quotation step, automatic saving and loading of proposal links when creating/editing quotations, consistent with negotiation history implementation for unified document tracking across entire quotation lifecycle
- July 28, 2025: **PROPOSAL LINK TRACKING IN NEGOTIATIONS** - Added proposal document link functionality to negotiation history system: new database field `proposalLink` in negotiation_history table, enhanced negotiation form with dedicated field for attaching document links (Google Drive, etc.), visual link display in negotiation history cards with external link icon, enables complete audit trail with direct access to negotiation proposals, maintains full document history for each negotiation round
- July 28, 2025: **NEGOTIATION TEAM ADJUSTMENT FEATURE IMPLEMENTED** - Extended negotiation history system to support comprehensive team composition changes during negotiations: enhanced database schema with previousTeam and newTeam JSON fields, created modern UX negotiation form component (negotiation-form-modern.tsx) that allows both price and team modifications in a single interface, updated backend routes and storage to handle team adjustment data, integrated current team data flow from quotation detail page to negotiation history component, supports 'team_adjustment' and 'mixed' change types for tracking pure team changes or combined price+team negotiations, enables sales teams to document and track how team compositions evolve during client negotiations for valuable business intelligence
- July 28, 2025: **NEGOTIATION HISTORY SYSTEM IMPLEMENTED** - Created comprehensive negotiation tracking system with database table `negotiation_history`, complete backend API routes and storage functions, frontend component `NegotiationHistory` integrated into quotation detail page, automatic price update when quotation moves from "in-negotiation" to "approved" status using last negotiated price, visual indicators in quotation management showing "Negociada" badge for approved quotations that went through negotiation, captures valuable sales intelligence including client feedback, internal notes, price adjustments and scope changes
- July 28, 2025: **QUOTATION CARDS UI ENHANCEMENT** - Fixed text truncation issues in quotation cards by implementing line-clamp-2 for project titles allowing up to 2 lines of text, improved spacing with p-5 padding, adjusted button layout to use flexbox with flex-1 for better responsive design, enhanced visual hierarchy with better spacing between elements, ensuring long project names display properly without breaking the card layout
- July 27, 2025: **AUTOMATIC DATE SORTING FOR QUOTATIONS** - Implemented automatic sorting by creation date (most recent first) in the quotations management page, ensuring users always see their latest quotations at the top of the list without manual intervention, improving workflow efficiency and user experience
- July 27, 2025: **FINANCIAL REVIEW UI/UX COMPLETELY REDESIGNED** - Implemented comprehensive collapsible sections (Configuración Financiera, Protección Inflacionaria) to reduce visual overwhelm on quotation final step, redesigned financial breakdown with numbered sections and color-coded cards for better hierarchy, enhanced manual pricing interface with modern 3-column metrics grid showing Cost/Markup/Profit, added informative tooltips throughout with TooltipProvider for better user guidance, created cleaner visual flow with professional gradients and improved spacing, optimized for reduced cognitive load while maintaining all functionality
- July 25, 2025: **COMPLETE MARKUP COHERENCE ACHIEVED SYSTEM-WIDE** - Fixed critical markup calculation inconsistency in financial analysis tab that was showing 62.3% (profit margin formula) instead of 265% (markup formula), unified ALL project tabs to use same source of truth: markup = price/cost = 2.65x = 265%, corrected tooltip explanations and progress bars, ensures mathematical coherence regardless of temporal filter or tab location, prevents business errors from inconsistent calculations
- July 24, 2025: **MARKUP CALCULATION COHERENCE FIXED** - Unified markup calculation logic across all components: both main cards and projections now use temporally-adjusted values (adjustedTotalAmount / totalActualCost) ensuring consistent display regardless of time filter selected, eliminates confusion where semester view showed 2.6x in main card but 1.3x in projections, professional coherence achieved across entire dashboard
- July 24, 2025: **ANNUAL REVENUE PROJECTION AND BURN RATE TOOLTIP IMPLEMENTED** - Fixed annual revenue projection for fee-mensual projects to calculate May-December (8 months × $29,230 = $233,840) instead of full year, added comprehensive tooltip for burn rate explaining it's the monthly budget consumption velocity with practical examples, ensures accurate financial projections for contracts starting mid-year
- July 24, 2025: **BURN RATE CALCULATION COHERENCE FIXED** - Corrected critical burn rate calculation in recommendations system: now uses actual months with data instead of theoretical filter months, for Q2 2025 (April-June) with data only in May-June, burn rate correctly shows $11,032.87 ($22,065.74 / 2 months) instead of $7,355.25 (÷ 3 months), ensures mathematical coherence across all temporal filters and accurate business intelligence metrics
- July 24, 2025: **QUARTERLY PROJECTION CALCULATION CORRECTED** - Fixed calculation interpretation for fee-mensual projects: quotation.baseCost ($10,113.4) is the monthly cost, not annual as initially misunderstood, Warner project Q3 projection correctly shows $30,340.20 cost (using $10,113.4/month × 3) with $57,349.80 profit, removed erroneous division by 12 that was causing underestimation of costs, ensures all future quarter projections use actual monthly contract rates from quotations
- July 24, 2025: **PREDICTIONS UI ENHANCED WITH BUSINESS INTELLIGENCE DASHBOARD** - Implemented comprehensive business intelligence improvements based on user feedback: added mini KPI dashboard showing real-time metrics (Margin 2.7x, Efficiency 105%, Profitability 65%), enhanced metric cards with month-to-month comparisons showing trends (Burn Rate +8% vs May), improved quarterly projections with visual center-stage design showing margin percentage, added contextual explanations for what projections mean ("what happens if we continue without changes"), implemented specific numeric metrics in recommendations (Dolores Camara: +68% excess, 47.7h extra, $667 overrun), optimized space utilization with compact cards and better information density, all changes focus on actionable business insights with temporal context
- July 24, 2025: **PREDICTIONS AND RECOMMENDATIONS UI/UX COMPLETELY REDESIGNED** - Complete visual overhaul of predictions/recommendations components: modern gradient headers (blue for predictions, purple for recommendations), professional card-based layouts with improved spacing and typography, contextual revenue projections using quarterly logic (Q2→Q3, current Q→remaining months), fixed "Revenue Anual Proyectado" to show "Facturación Anual Proyectada" with proper business logic (annual contract value for fee-mensual projects), enhanced projection cards with better visual hierarchy and icons, temporal context awareness in all texts and calculations, eliminated card duplications mentioned by user
- July 24, 2025: **BUSINESS INTELLIGENCE PREDICTIONS AND RECOMMENDATIONS REDESIGNED** - Complete overhaul of predictions/recommendations system with strategic business focus: replaced technical metrics with business intelligence metrics (Burn Rate, Annual Revenue Projection, Break-Even Point, Client Satisfaction Risk), enhanced recommendations to detect financial risks with annual overrun projections, operational inefficiencies with specific team members identification, profitability opportunities with revenue calculations, monthly trend analysis for significant variations, resource optimization for under-utilized team members, fixed temporal filtering to work correctly with past periods, translated "achieved" to "Alcanzado" in Spanish, improved recommendation deduplication to avoid repeating same team members
- July 24, 2025: **DEVIATION ANALYSIS UX/UI COMPLETELY REDESIGNED** - Completely redesigned the deviation analysis dashboard for clearer metrics and better user understanding: replaced confusing "Diferencia vs Presupuesto" with clear "Sobrecosto Total" vs "Ahorro Total" cards with dynamic colors, improved card labels from technical terms to business language ("Miembros con Sobrecosto", "Miembros Eficientes", "Casos Críticos"), added comprehensive project health indicator with efficiency percentage and status badges, redesigned recommendations section with actionable insights and navigation prompts, enhanced visual hierarchy with better color coding and intuitive icons, implemented intelligent severity detection for critical cases requiring immediate attention
- July 24, 2025: **FINANCIAL ANALYSIS TOOLTIPS IMPLEMENTED** - Added comprehensive explanatory tooltips to all financial KPI cards in the "Análisis Financiero y Económico" tab: ROI card explains return on investment calculation and performance thresholds, Profit Margin card details the formula and interpretation ranges, Cost Efficiency card describes budget control metrics, Revenue per Hour card explains productivity calculation, all tooltips include detailed formulas and color-coded performance indicators for better user understanding
- July 23, 2025: **HEAT MAP COMPONENT OPTIMIZED FOR FULL-WIDTH DISPLAY** - Optimized heat map for better visibility: 8 columns layout (grid-cols-8), full-width design without container restrictions, increased cell height to h-20, improved gap spacing (gap-3), larger text size (text-sm), enhanced padding (p-2), name truncation up to 10 characters, better proportioned cells that utilize the entire component width while maintaining functionality
- July 23, 2025: **PIE CHART COMPONENTS ENLARGED FOR BETTER LABEL VISIBILITY** - Increased size of all pie chart components across the application: project details page charts enlarged from outerRadius={80} to outerRadius={120} with containers increased from h-64 to h-96, dashboard charts enlarged from outerRadius={100} to outerRadius={120} with containers increased from h-72 to h-80, history page charts enlarged from outerRadius={80} to outerRadius={110} with containers increased from h-64 to h-80, added labelLine properties for better label positioning, improved readability of role distribution and cost analysis charts
- July 23, 2025: **ANÁLISIS DETALLADO TAB RESTRUCTURED WITH FUNCTIONAL COMPONENTS** - Completely replaced the deprecated "Advanced Team Performance Analysis" section in the "Análisis detallado" tab with three new functional components: "Optimizador de Presupuesto" (intelligent budget optimization recommendations), "Proyecciones Predictivas" (predictive analysis based on current trends), and "Centro de Alertas y Riesgos" (automatic risk monitoring and alerts system), eliminated heat map and unified ranking from details tab as they are now properly located in the performance tab, new components provide actionable business intelligence instead of redundant visualizations
- July 23, 2025: **CRITICAL DOUBLE-SCALING BUG FIXED SYSTEM-WIDE** - Completely eliminated double temporal scaling throughout the system: backend correctly sends already-scaled hours (Santiago: 400h for Q2), frontend now uses these values directly without additional multipliers, fixed EconomicRankings display from "236h / 1200h" to correct "236h / 400h", removed getTimeMultiplier() application in frontend components, corrected all dashboard cards and progress bars to use backend-provided scaled values, system now works correctly for ANY temporal filter and ANY future project
- July 22, 2025: **SISTEMA SEMÁFORO VISUAL COMPLETO** - Implementado sistema visual completo con colores dinámicos: card amarilla para Regular (5% sobrecosto), verde para Bueno, rojo para Crítico, iconos distintivos (Corona, CheckCircle, AlertTriangle, TrendingDown), emojis de semáforo (🏆 Excelente, ✅ Bueno, 🟡 Regular, 🔴 Crítico), bordes y fondos que cambian según el estado financiero, badges con colores correspondientes
- July 22, 2025: **CORREGIDO SEMÁFORO DE SALUD FINANCIERA** - Identificada y corregida card de Estado morada que mostraba "Excelente" incorrectamente, cambiada lógica de markup (precio/costo) a evaluación de presupuesto (costo real vs costo estimado), con 5% sobrecosto ahora muestra "Regular" apropiadamente, sistema de semáforo implementado: Excelente (≤85%), Bueno (≤100%), Regular (≤110%), Crítico (>110%)
- July 21, 2025: **AGREGADAS CARDS DE CONTEXTO FINANCIERO** - Añadidas dos nuevas cards esenciales: "Precio Cliente" (valor facturado mensual) y "Costo Estimado" (costo operativo planificado), layout expandido a 6 columnas, colores distintivos (emerald/rose), badges descriptivos, proporciona contexto inmediato sobre magnitud financiera del proyecto
- July 21, 2025: **MEJORADA CLARIDAD DE NOMBRES EN CARDS PRINCIPALES** - Cambiados nombres de cards por versiones más descriptivas: "Progreso" → "Avance de Horas", "Presupuesto" → "Uso de Budget", subtítulo de Markup cambiado a "Precio cliente / Costo real" para mayor claridad, mejora UX en comprensión de métricas
- July 21, 2025: **CORREGIDO ESCALAMIENTO TEMPORAL PARA PROYECTOS FEE-MENSUAL** - Solucionado bug crítico donde proyectos tipo "fee-mensual" no aplicaban escalamiento temporal correctamente, ahora detecta meses reales con datos vs meses teóricos del filtro, para "Trimestre pasado" con datos solo en mayo-junio usa 2 meses en lugar de 3, corrige eficiencia de 215%+ a valores correctos como 107.93%
- July 21, 2025: **SISTEMA DE AJUSTES DE HORAS MENSUALES IMPLEMENTADO** - Creado sistema completo para manejar cambios en asignaciones de horas por mes/año específicos: nueva tabla `monthly_hour_adjustments` con CRUD completo, API endpoints para gestión (`/api/projects/:id/monthly-hour-adjustments`), integración automática en cálculos de equipo que respeta filtros temporales, funcionalidad probada exitosamente con Santiago Berisso (80h mayo → 160h junio 2025), permite correcciones históricas sin alterar valores base de cotizaciones
- July 21, 2025: **CRITICAL TEMPORAL SCALING LOGIC CORRECTION** - Corregido conceptualmente el escalamiento temporal: las horas estimadas INDIVIDUALES de cada persona (ej: Santiago Berisso 160h) se mantienen constantes como valores base de referencia, el escalamiento temporal solo se aplica a totales del proyecto para comparaciones de progreso general, eliminado escalamiento incorrecto en horas estimadas individuales que causaba confusión (160h × 3 = 480h), sistema ahora muestra correctamente horas base vs horas trabajadas reales por persona
- July 19, 2025: **ENHANCED TIME REGISTRATION CARDS** - Agregadas dos nuevas cards informativas en la pestaña "Registro de Tiempo": "Horas Trabajadas vs Estimadas" y "Costo Real vs Estimado", ambas completamente funcionales con filtro temporal, barras de progreso con códigos de color inteligentes, y datos consistentes con el resto del sistema
- July 19, 2025: **INTERFACE CLEANUP - REMOVED REDUNDANT STATISTICS** - Eliminada la sección de estadísticas redundantes de la parte inferior de la pestaña "Registro de Tiempo" que mostraba "Horas Estimadas", "Costo Estimado", "Horas Trabajadas", "Costo Real" y "Progreso General", dejando la interfaz más limpia y enfocada
- July 19, 2025: **CRITICAL APPLICATION FIXES** - Corregidos problemas críticos de autenticación: eliminado doble QueryClientProvider que causaba conflictos, simplificado manejo de autenticación removiendo tempUserId, agregadas credenciales de prueba en página de login para facilitar acceso (demo@epical.digital/demo123, tomas@epical.digital/epical2025)
- July 19, 2025: **SISTEMA DE DETECCIÓN DE PERSONAL NO COTIZADO COMPLETAMENTE FUNCIONAL** - Sistema completamente implementado y probado exitosamente: detecta automáticamente personal no cotizado al registrar tiempo, muestra diálogo para asignar horas estimadas, guarda en tabla `unquoted_personnel`, incluye las horas en totales del proyecto, backend corregido con sobrecarga de `apiRequest` para manejar ambos formatos de parámetros, personal no cotizado aparece en `teamBreakdown` con flag `isUnquoted: true`
- July 18, 2025: **SISTEMA COMPLETO DE DETECCIÓN DE PERSONAL NO COTIZADO** - Implementado sistema profesional para detectar automáticamente cuando personal registra tiempo sin estar en cotización original, incluye alertas visuales naranjas informativas, indicadores rojos en tabla con badge "No cotizado", y bordes distintivos en registros, el personal no cotizado NO se agrega al equipo base sino que solo se marca visualmente para incluir sus horas en totales del proyecto sin comparación individual con estimaciones
- July 18, 2025: **SESSION PERSISTENCE EXTENDED TO 30 DAYS** - Fixed session configuration to maintain user authentication for 30 days instead of 7 days, preventing frequent logouts and improving user experience with persistent sessions that survive server restarts
- July 18, 2025: **COMPLETE OPTIMISTIC ANIMATION SYSTEM** - Implemented instant modal closure after time entry creation, optimized temporary record detection with timestamp-based IDs, immediate cache invalidation for better performance, and smooth animations with minimal "thinking" time
- July 18, 2025: **FULL EDITING FUNCTIONALITY COMPLETED** - Added comprehensive edit capability for existing time entries with professional modal interface, all fields editable (person, date, hours, description, billable status), automatic cost calculation, and complete validation system
- July 18, 2025: **WORLD-CLASS TIME REGISTRATION INTERFACE IMPLEMENTED** - Complete professional redesign of time entry page with industry-standard filters: comprehensive date options (Este mes, Trimestre, Semestre, Q1-Q4, ALL individual months), modern card-based layout with clean typography, grouped filter categories (General, Trimestres, Meses), enhanced professional table with hover effects, improved search functionality, and sophisticated statistics dashboard with color-coded metrics
- July 18, 2025: **COMPLETE TEMPORAL FILTERING SYSTEM UNIFICATION** - Successfully unified ALL components to use single source of truth (`/api/projects/:id/complete-data`) with temporal filtering, backend now generates `teamBreakdown` filtered by date range, eliminated inconsistent data sources where "Análisis de Equipo" tab was using non-filtered `baseTeam`, ALL 4 tabs (Dashboard, Análisis de Equipo, Registro de Tiempo, Análisis Mensual) now respect temporal filtering consistently, supports any time filter (Mayo 2025: ~925h, Junio 2025: ~1,015h, Julio 2025: ~313h), automatic cache invalidation ensures all components update simultaneously when filter changes, FIXED "Análisis Mensual" tab to use completeData instead of raw timeEntries/personnel props
- July 17, 2025: **CRITICAL BUG FIXED - CARDS PRINCIPALES WORKING** - Solved the root cause: backend was reading wrong field (`entry.cost` instead of `entry.totalCost`) preventing cost calculations, now markup shows correct values (2.72x for June), all cards display real data from unified `useCompleteProjectData` hook, temporal filtering working correctly, requires user authentication to access data
- July 17, 2025: **FINAL TEMPORAL FILTERING SYSTEM FIX** - Completed unification of data sources across ALL project analysis tabs, eliminated inconsistencies where team and performance tabs were using local variables instead of unified `completeData` from `useCompleteProjectData` hook, now ALL tabs (Dashboard, Team, Monthly, Performance) use exclusively the `/api/projects/:id/complete-data` endpoint with temporal filtering applied consistently
- July 17, 2025: **CRITICAL TEMPORAL FILTERING SYSTEM UNIFIED** - Implemented single source of truth with `useCompleteProjectData` hook that supports temporal filtering across all project tabs, fixed inconsistent data sources where different tabs were using separate endpoints, now all metrics are calculated from the same filtered dataset ensuring consistency between dashboard, team analysis, and monthly analytics
- July 17, 2025: **COMPREHENSIVE TOOLTIPS REDESIGN** - Redesigned all 6 KPI tooltips with compact format (left-positioned, w-48, clear text) explaining calculation logic and color criteria, fixed positioning issues to prevent cutoff, clarified "vs estimado" text to show specific values like "219h trabajadas de 969h cotizadas", clear distinction between Score de Salud (general project health) vs Score de Calidad (deliverable quality), all with real-time data from quotation comparisons
- July 17, 2025: **HEAT MAP VISUALIZATION ENHANCEMENT** - Replaced initials with full names (truncated at 12 characters) in heat map grid and improved tooltip explanations for color coding system using real data from time entries
- July 17, 2025: **MONTHLY ANALYSIS DASHBOARD REFINEMENT** - Enhanced world-class monthly analysis tab with comprehensive explanations of all metrics: strategic color system (red=critical, yellow=attention, green=good, white=neutral) with detailed calculation formulas
- July 16, 2025: **TIME REGISTRATION UI IMPROVEMENTS** - Changed registration component background from purple gradient to clean white design, replaced confusing "En progreso" badge with clearer "Parcial" for past time periods, improved visual hierarchy with neutral gray color scheme
- July 16, 2025: **PERSISTENT SESSION IMPLEMENTATION** - Implemented persistent sessions that survive server restarts and code changes using PostgreSQL session store with 30-day persistent cookies, eliminating automatic logout frustration
- July 16, 2025: **SESSION CONFIGURATION OPTIMIZATION** - Extended session maxAge to 7 days, optimized session settings (resave: false, saveUninitialized: false) for better performance and persistence
- July 16, 2025: **COOKIE-PARSER INTEGRATION** - Added cookie-parser middleware for proper persistent cookie handling and session recovery functionality
- July 16, 2025: **TIME REGISTRATION UX ENHANCEMENT** - Removed hanging card, added informative tooltips showing exact hours worked vs estimated with color-coded progress badges and intelligent progress bars
- July 16, 2025: **DECIMAL FORMATTING CONSISTENCY** - Fixed excessive decimal display issues (like 1171.50000000000002h) by applying consistent toFixed() formatting across all analytics components
- July 15, 2025: **OPTIMISTIC ANIMATIONS RESTORED** - Restored smooth optimistic animations for time entry creation and deletion with proper visual feedback and automatic modal closure
- July 15, 2025: **UX IMPROVEMENTS** - Modal now closes automatically after successful registration, reduced loader display time from 300ms to 100ms for better responsiveness
- July 15, 2025: **VISUAL FEEDBACK ENHANCEMENT** - Added temporary loading states with spinner and blue background for pending records, slide-out animation for deletions
- July 15, 2025: **INTERFACE CONSISTENCY** - Fixed undefined member.personnelName.split() error and unified purple gradient styling across all time management tabs
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