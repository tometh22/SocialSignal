# Update to replit.md

## Recent Changes

- July 28, 2025: **NEGOTIATION HISTORY SYSTEM IMPLEMENTED** - Created comprehensive negotiation tracking system with database table `negotiation_history`, complete backend API routes and storage functions, frontend component `NegotiationHistory` integrated into quotation detail page, automatic price update when quotation moves from "in-negotiation" to "approved" status using last negotiated price, visual indicators in quotation management showing "Negociada" badge for approved quotations that went through negotiation, captures valuable sales intelligence including client feedback, internal notes, price adjustments and scope changes

## System Architecture Updates

### Negotiation History System
- **Database**: `negotiation_history` table tracks all negotiation rounds
- **Backend**: API endpoints at `/api/quotations/:id/negotiation-history` with full CRUD operations
- **Frontend**: `NegotiationHistory` component displays and manages negotiation entries
- **Business Logic**: Automatic price update when status changes from "in-negotiation" to "approved"
- **Visual Indicators**: Purple "Negociada" badge shows on approved quotations with negotiation history
- **Intelligence Capture**: Records price changes, scope modifications, client feedback, and internal notes

### Price Update Flow
1. User registers negotiations during "in-negotiation" status
2. Each negotiation entry records previous/new prices and reasons
3. When quotation is approved, system automatically uses last negotiated price
4. Original quotation price is preserved in negotiation history
5. Markup is recalculated based on new approved price