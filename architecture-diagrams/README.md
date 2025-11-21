# Vocalytics Architecture Diagrams - Exported

All diagrams have been exported in both **PNG** and **PDF** formats.

## Diagram Files

### 1. High-Level System Architecture
- **Files**: `1-high-level-system.png`, `1-high-level-system.pdf`
- **Shows**: Complete system from user browser through Vercel platform to external services
- **Use for**: Executive presentations, high-level overviews

### 2. Detailed Application Architecture
- **Files**: `2-detailed-architecture.png`, `2-detailed-architecture.pdf`
- **Shows**: All frontend pages, state management, backend routes, middleware, services, and database tables
- **Use for**: Technical design reviews, onboarding new developers

### 3. Authentication Flow
- **Files**: `3-authentication-flow.png`, `3-authentication-flow.pdf`
- **Shows**: User registration, login, and session management with JWT cookies
- **Use for**: Security audits, explaining authentication to stakeholders

### 4. Video Analysis Flow
- **Files**: `4-video-analysis-flow.png`, `4-video-analysis-flow.pdf`
- **Shows**: Complete analysis process from button click through YouTube API, OpenAI API, to database storage
- **Use for**: Explaining core feature, performance optimization discussions

### 5. Payment Flow
- **Files**: `5-payment-flow.png`, `5-payment-flow.pdf`
- **Shows**: Stripe checkout, webhook processing with idempotency, and tier upgrades
- **Use for**: Billing system reviews, troubleshooting payment issues

### 6. Database Schema
- **Files**: `6-database-schema.png`, `6-database-schema.pdf`
- **Shows**: All 8 tables with relationships and key fields
- **Use for**: Database design reviews, query optimization planning

### 7. Technology Stack
- **Files**: `7-technology-stack.png`, `7-technology-stack.pdf`
- **Shows**: Complete dependency tree of frontend, backend, external APIs, and deployment
- **Use for**: Technology decisions, dependency audits, technical interviews

## File Formats

- **PNG** (2400x1800px): Best for presentations, web sharing, Slack/email
- **PDF**: Best for printing, high-quality documentation, archiving

## Source Files

- `.mmd` files contain the original Mermaid syntax
- Can be edited and re-exported using: `mmdc -i filename.mmd -o filename.png`

## Created
November 21, 2025
