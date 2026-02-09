# SecureScanner - NSFW Content Detection Application

## Overview

SecureScanner is a full-stack web application designed for detecting and managing NSFW (Not Safe For Work) content in files. The application features a mobile-first Progressive Web App (PWA) frontend built with React and TypeScript, and a REST API backend powered by Express.js. The system uses PostgreSQL with Drizzle ORM for data persistence and includes comprehensive scanning capabilities for images, videos, and documents.

## User Preferences

Preferred communication style: Simple, everyday language.
Color scheme preference: Charcoal gray background with darker matte cyan (#029fad) accents.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom charcoal and matte cyan color scheme
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for development and production builds
- **PWA Features**: Service worker for caching and offline functionality

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **File Handling**: Multer for multipart/form-data processing (50MB limit)
- **NSFW Detection**: NSFWJS with TensorFlow.js (MobileNetV2Mid model, ~93% accuracy)
- **Development**: Hot reloading with Vite middleware integration

### NSFW Detection Engine
- **Library**: NSFWJS v4.2.1 with @tensorflow/tfjs-node
- **Model**: InceptionV3 (higher accuracy, 299x299 input, server-optimized)
- **Categories**: Classifies images into Porn, Hentai, Sexy, Drawing, Neutral
- **Category Mapping**: Porn → explicit, Hentai → adult, Sexy → suggestive, Drawing/Neutral → safe
- **Detection Strategy**: Multi-crop analysis (full image + center/top/bottom crops) with combined + weighted NSFW scoring
- **Per-Category Thresholds**: Porn >= 15%, Hentai >= 15%, Sexy >= 25%, combined >= 30%, weighted >= 20%
- **Confidence Threshold**: Configurable per scan session (default 0.3)
- **Memory Management**: Proper tensor disposal with tracked tensor cleanup in finally blocks
- **Error Handling**: Graceful fallback for unsupported file types, empty buffer detection, detailed logging

### Database Architecture
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with type-safe queries
- **Connection**: Neon Database serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Database Schema
The application uses three main entities:

1. **Users Table**
   - `id` (serial primary key)
   - `username` (unique text)
   - `password` (text)

2. **Scan Sessions Table**
   - `id` (serial primary key)
   - `userId` (foreign key to users)
   - `startTime` and `endTime` (timestamps)
   - `status` (active, completed, paused, failed)
   - `totalFiles`, `processedFiles`, `nsfwFound` (integers)

3. **Scan Results Table**
   - `id` (serial primary key)
   - `sessionId` (foreign key to scan sessions)
   - `filename`, `filepath`, `fileType` (text fields)
   - `isNsfw` (boolean), `confidence` (real number)
   - `processed` (boolean), `createdAt` (timestamp)

### Core Features
- **Dashboard**: Real-time scanning progress and statistics
- **File Management**: View and filter detected files by type and NSFW status
- **Reporting**: Export scan results and view detailed analytics
- **Settings**: Configure security preferences and scanning options
- **Progressive Web App**: Installable mobile app with offline capabilities

### API Endpoints
- `POST /api/scan-sessions` - Create new scan session
- `GET /api/scan-sessions/:id` - Get specific scan session
- `PUT /api/scan-sessions/:id` - Update scan session
- `GET /api/scan-sessions/active` - Get active scan sessions
- `POST /api/scan-results` - Create scan result
- `GET /api/scan-results/:sessionId` - Get results for session
- `GET /api/nsfw-results` - Get NSFW-flagged content
- `GET /api/stats` - Get scanning statistics

## Data Flow

1. **Scan Initiation**: User starts a new scan from the dashboard
2. **Session Creation**: Backend creates a new scan session record
3. **File Processing**: Files are analyzed for NSFW content with confidence scores
4. **Result Storage**: Individual file results are stored with session association
5. **Progress Updates**: Frontend polls for real-time progress updates
6. **Result Display**: Users can view, filter, and export scan results

## External Dependencies

### Production Dependencies
- **UI Components**: Comprehensive Radix UI component library
- **Database**: Neon Database serverless PostgreSQL
- **File Processing**: Multer for handling file uploads
- **Date Handling**: date-fns for date manipulation
- **Validation**: Zod with Drizzle Zod integration for type-safe schemas

### Development Tools
- **TypeScript**: Strict type checking with ESNext modules
- **Vite**: Fast development server and build tool
- **PostCSS**: CSS processing with Tailwind CSS
- **ESBuild**: Fast bundling for production builds

## Deployment Strategy

### Development
- Vite development server with HMR
- TypeScript compilation with strict mode
- Automatic Replit integration with error overlays

### Production
1. **Frontend Build**: Vite builds React app to `dist/public`
2. **Backend Build**: ESBuild bundles Express server to `dist/index.js`
3. **Database**: Drizzle migrations applied via `db:push` command
4. **Environment**: Requires `DATABASE_URL` environment variable

### Recent Major Enhancements (January 2025)

**Enhanced Color System**: Implemented optimized charcoal gray and matte cyan (#029fad) color scheme with mathematically pleasing contrast ratios for improved visual accessibility and user preference alignment.

**Comprehensive Scan Customization**: Added extensive scan configuration system allowing users to customize:
- Target folders and file types
- Detection confidence thresholds  
- Automatic actions (move, rename, backup, quarantine)
- Scheduled and custom scan types

**Advanced File Organization**: Implemented intelligent file categorization and organization system that:
- Categorizes flagged content by type (explicit, suggestive, adult, violent, disturbing)
- Automatically renames files with timestamps and categories
- Moves files to organized folder structures (/SecureScanner/[category]/)
- Tracks original and new file paths

**App Personalization**: Added comprehensive customization options including:
- Theme color selection
- Interface preferences (sounds, animations, compact mode)
- Custom CSS support for advanced users
- Auto-refresh and notification settings

**Dedicated Scan Interface**: Created separate scan landing page with:
- Real-time progress tracking
- Scan control buttons (pause, resume, stop)
- Live flagged content preview
- One-click file organization functionality

**Database Integration**: Migrated from in-memory storage to PostgreSQL database:
- Implemented DatabaseStorage class with full CRUD operations
- Applied database schema with proper relations and constraints
- Maintains all existing functionality while adding data persistence
- Uses Drizzle ORM for type-safe database operations

### Key Design Decisions

**Database Choice**: PostgreSQL with Drizzle ORM chosen for type safety and scalability over simpler solutions. Drizzle provides excellent TypeScript integration and migration management.

**Frontend Framework**: React with Vite selected for fast development experience and PWA capabilities. TanStack Query handles complex server state management effectively.

**Mobile-First Design**: Tailwind CSS with custom responsive breakpoints ensures optimal mobile experience, which is crucial for a security-focused application.

**File Upload Strategy**: Multer with memory storage chosen for simplicity, with 50MB limit to prevent abuse while accommodating typical media files.

**Authentication**: Basic user system implemented but not fully integrated, allowing for future expansion of multi-user capabilities.

**Color Psychology**: Charcoal gray provides professional, non-distracting background while matte cyan offers sufficient contrast (WCAG AA compliant) without being harsh on the eyes during extended use.

The architecture prioritizes developer experience, type safety, mobile usability, and comprehensive customization while maintaining flexibility for future security feature additions.