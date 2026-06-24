# ServicePilot - Product Overview

_Generated: Mon Jun 22 18:50:27 UTC 2026_

AI automation SaaS for home-services & repair businesses. Acts as a 24/7 AI receptionist, dispatcher, booking assistant, missed-call recovery system, customer-support agent, review collector, and business-automation dashboard. Multi-tenant with role-based access (OWNER / DISPATCHER / TECHNICIAN + super-admin). Stack: Next.js 16 (App Router, Turbopack) + TypeScript, Tailwind v4, PostgreSQL 16, Prisma, custom JWT auth (jose + bcryptjs), AI via Groq (OpenAI-compatible), Twilio for SMS/voice.

## Repository
```
Remote: https://github.com/abdulmuqtadar7/AI-Home-Services-Repairs
Branch: main
HEAD:   d574957
```

## Recent commits
```
d574957 feat: customer lifetime value + history on customer detail (LTV, avg ticket, job count, avg rating, timeline)
48ef2e7 feat: review insights panel on Reviews page (sentiment, themes, recent comments, on-demand analyze)
49a53a9 feat: AI review insights (reviewInsights lib + /api/reviews/analyze batch endpoint)
6e63a05 feat: review-request SMS links to in-app feedback page (gated routing) instead of Google directly
043ff34 feat: first-party review capture (Review model + public /feedback page & API with happy-path Google routing)
07506ed feat: inline-expanding dashboard cards + pipeline tiles (dashboard/jobs API, StatCards, PipelineTiles) + jobs days/dateField filters
f69e7fb feat: reporting/exports (CSV + Reports page) + clickable dashboard cards/pipeline with jobs filtering
5aeb1ab feat: Suggested techs in DispatchPanel (top-3 skill/workload ranking with one-click use)
4aaa707 feat: smart technician routing engine + /api/jobs/[id]/suggest-tech (ranks techs by skill match and workload)
03795a8 feat: Hot leads panel on dashboard (top 5 ranked open leads with tier badges and reasons)
22460c4 feat: AI lead scoring engine + ranked /api/leads/scored endpoint (urgency, freshness, contactability, loyalty, value)
b9b0503 feat: one-click Weekly digest button on dashboard (optional SMS to business phone)
3c296dc feat: weekly business digest API (7-day leads/revenue/recoveries/reviews summary, optional SMS to business phone)
21ddcac feat: upgraded owner dashboard (revenue, 30-day activity, pipeline-by-status, upcoming appointments)
abfc2b7 feat: Send-reminders button on calendar (one-click pre-visit SMS run for owners/dispatchers)
3aaabe5 feat: appointment reminders runner (idempotent pre-visit SMS via reminderSentAt)
192425c feat: Dispatch panel on job detail (assign technician + dispatch/re-dispatch from the browser)
9a14278 feat: job dispatch action (assign technician, set DISPATCHED, SMS tech, notify) + JOB_DISPATCHED notification type
3864d1c feat: appointments API + interactive calendar (schedule/reschedule/reassign/cancel with per-technician double-booking conflict detection)
79a8cec feat: inbound SMS support inbox (Twilio SMS webhook to AI reply + booking, SMS-channel conversations)
60810c7 feat: review request sending (SMS with Google review link, dedupe on reviewRequestedAt, force resend, audit log)
4ff095b feat: missed-call recovery (voice status webhook to recovery SMS + in-app notification)
f75bb81 feat: Twilio AI voice receptionist (inbound call to speech Gather to AI booking + notifications)
5d9be94 feat: in-app notifications (bell UI, list/mark-read API, AI booking + emergency hooks)
389ee53 feat: review collection - Reviews page, request-review API, copyable review message
69271c4 feat: embeddable AI chat widget (loader script, embed page) + in-app website widget snippet panel
19cd215 feat: multi-trade + service catalog in super-admin register business
8909a04 feat: technician read-only job detail with status-only updates
b95b5ca feat: service catalog editing as its own nav page
bb4fcc4 fix: fresh chat session per visit and dated AI bookings
```

## package.json
```json
{
  "name": "servicepilot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "bcryptjs": "^3.0.3",
    "clsx": "^2.1.1",
    "date-fns": "^4.4.0",
    "jose": "^6.2.3",
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "prisma": "^6.19.3",
    "tailwindcss": "^4",
    "tsx": "^4.22.4",
    "typescript": "^5"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

## Prisma schema
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- ENUMS ----------

enum MemberRole {
  OWNER
  DISPATCHER
  TECHNICIAN
}

enum ServiceNiche {
  PLUMBING
  HVAC
  ELECTRICAL
  ROOFING
  PEST_CONTROL
  CLEANING
  APPLIANCE_REPAIR
  HANDYMAN
  GENERAL_REPAIR
  OTHER
}

enum ConversationChannel {
  WEB_CHAT
  SMS
  WHATSAPP
  VOICE
  EMAIL
}

enum ConversationStatus {
  NEW_LEAD
  AI_HANDLING
  HUMAN_NEEDED
  BOOKED
  COMPLETED
  LOST
}

enum MessageSender {
  CUSTOMER
  AI
  HUMAN_AGENT
  SYSTEM
}

enum JobStatus {
  NEW_LEAD
  QUALIFIED
  ESTIMATE_REQUESTED
  BOOKED
  DISPATCHED
  IN_PROGRESS
  COMPLETED
  PAID
  REVIEW_REQUESTED
  LOST_CANCELLED
}

enum UrgencyLevel {
  LOW
  NORMAL
  HIGH
  EMERGENCY
}

enum CustomerType {
  RESIDENTIAL
  COMMERCIAL
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  RESCHEDULED
  CANCELLED
  COMPLETED
  NO_SHOW
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  VOID
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REFUNDED
}

enum NotificationType {
  NEW_LEAD
  URGENT_LEAD
  HUMAN_HANDOFF
  NEW_BOOKING
  CANCELLED_BOOKING
  JOB_COMPLETED
  PAYMENT_RECEIVED
  AI_FAILURE
  MISSED_CALL_RECOVERED
  JOB_DISPATCHED
}

// ---------- CORE / AUTH ----------

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  phone        String?
  isSuperAdmin Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships   BusinessMember[]
  technician    Technician?
  notifications Notification[]   @relation("NotificationRecipient")
  auditLogs     AuditLog[]
}

model Business {
  reviews             Review[]
  id                  String         @id @default(cuid())
  name                String
  niche               ServiceNiche   @default(GENERAL_REPAIR)
  trades              ServiceNiche[] @default([])
  email               String?
  phone               String?
  website             String?
  openingHours        Json?
  accessRequestedAt   DateTime?
  emergencyAvailable  Boolean        @default(false)
  diagnosticFee       Decimal?       @db.Decimal(10, 2)
  googleReviewLink    String?
  onboardingCompleted Boolean        @default(false)
  status              BusinessStatus @default(ACTIVE)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  members            BusinessMember[]
  customers          Customer[]
  conversations      Conversation[]
  messages           Message[]
  jobs               Job[]
  services           Service[]
  technicians        Technician[]
  appointments       Appointment[]
  invoices           Invoice[]
  payments           Payment[]
  notifications      Notification[]
  serviceAreas       ServiceArea[]
  aiSetting          AiSetting?
  integrationSetting IntegrationSetting?
  auditLogs          AuditLog[]
}

model BusinessMember {
  id         String     @id @default(cuid())
  businessId String
  userId     String
  role       MemberRole @default(OWNER)
  createdAt  DateTime   @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([businessId, userId])
  @@index([businessId])
}

// ---------- CRM / OPERATIONS ----------

model Customer {
  reviews     Review[]
  id          String       @id @default(cuid())
  businessId  String
  name        String?
  phone       String?
  email       String?
  address     String?
  zipCode     String?
  type        CustomerType @default(RESIDENTIAL)
  isReturning Boolean      @default(false)
  notes       String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  business      Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  jobs          Job[]
  appointments  Appointment[]
  invoices      Invoice[]

  @@index([businessId])
  @@index([businessId, phone])
}

model Conversation {
  id            String              @id @default(cuid())
  businessId    String
  customerId    String?
  channel       ConversationChannel @default(WEB_CHAT)
  status        ConversationStatus  @default(NEW_LEAD)
  externalRef   String? // e.g. twilio number, web session id
  aiActive      Boolean             @default(true)
  lastMessageAt DateTime            @default(now())
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  messages Message[]
  job      Job?

  @@index([businessId])
  @@index([businessId, status])
}

model Message {
  id             String        @id @default(cuid())
  businessId     String
  conversationId String
  sender         MessageSender
  content        String
  metadata       Json?
  createdAt      DateTime      @default(now())

  business     Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}

model Service {
  id          String        @id @default(cuid())
  businessId  String
  name        String
  niche       ServiceNiche?
  description String?
  basePrice   Decimal?      @db.Decimal(10, 2)
  durationMin Int           @default(60)
  active      Boolean       @default(true)
  createdAt   DateTime      @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  jobs     Job[]

  @@index([businessId])
}

model Technician {
  id         String   @id @default(cuid())
  businessId String
  userId     String?  @unique
  name       String
  phone      String?
  email      String?
  skills     String[]
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())

  business     Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user         User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  jobs         Job[]
  appointments Appointment[]

  @@index([businessId])
}

model Job {
  reviews           Review[]
  id                String       @id @default(cuid())
  businessId        String
  customerId        String?
  serviceId         String?
  technicianId      String?
  conversationId    String?      @unique
  title             String
  problem           String?
  address           String?
  zipCode           String?
  urgency           UrgencyLevel @default(NORMAL)
  status            JobStatus    @default(NEW_LEAD)
  customerType      CustomerType @default(RESIDENTIAL)
  scheduledAt       DateTime?
  amountCharged     Decimal?     @db.Decimal(10, 2)
  notes             String?
  reviewRequestedAt DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  business     Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  customer     Customer?     @relation(fields: [customerId], references: [id], onDelete: SetNull)
  service      Service?      @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  technician   Technician?   @relation(fields: [technicianId], references: [id], onDelete: SetNull)
  conversation Conversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  appointments Appointment[]
  invoices     Invoice[]

  @@index([businessId])
  @@index([businessId, status])
}

model Appointment {
  id             String            @id @default(cuid())
  businessId     String
  jobId          String?
  customerId     String?
  technicianId   String?
  startAt        DateTime
  endAt          DateTime
  status         AppointmentStatus @default(SCHEDULED)
  reminderSentAt DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  business   Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  job        Job?        @relation(fields: [jobId], references: [id], onDelete: SetNull)
  customer   Customer?   @relation(fields: [customerId], references: [id], onDelete: SetNull)
  technician Technician? @relation(fields: [technicianId], references: [id], onDelete: SetNull)

  @@index([businessId])
  @@index([businessId, startAt])
}

// ---------- BILLING ----------

model Invoice {
  id                  String        @id @default(cuid())
  businessId          String
  jobId               String?
  customerId          String?
  number              String
  amount              Decimal       @db.Decimal(10, 2)
  status              InvoiceStatus @default(DRAFT)
  stripePaymentLinkId String?
  stripeInvoiceId     String?
  dueDate             DateTime?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  job      Job?      @relation(fields: [jobId], references: [id], onDelete: SetNull)
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  payments Payment[]

  @@unique([businessId, number])
  @@index([businessId])
}

model Payment {
  id                    String        @id @default(cuid())
  businessId            String
  invoiceId             String?
  amount                Decimal       @db.Decimal(10, 2)
  status                PaymentStatus @default(PENDING)
  stripePaymentIntentId String?
  paidAt                DateTime?
  createdAt             DateTime      @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  invoice  Invoice? @relation(fields: [invoiceId], references: [id], onDelete: SetNull)

  @@index([businessId])
}

// ---------- SYSTEM / CONFIG ----------

model Notification {
  id          String           @id @default(cuid())
  businessId  String
  recipientId String?
  type        NotificationType
  title       String
  body        String?
  read        Boolean          @default(false)
  metadata    Json?
  createdAt   DateTime         @default(now())

  business  Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  recipient User?    @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: SetNull)

  @@index([businessId])
  @@index([businessId, read])
}

model ServiceArea {
  id         String   @id @default(cuid())
  businessId String
  zipCode    String
  city       String?
  label      String?
  createdAt  DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([businessId, zipCode])
  @@index([businessId])
}

model AiSetting {
  id                   String   @id @default(cuid())
  businessId           String   @unique
  greeting             String?
  tone                 String   @default("friendly") // friendly | professional | casual
  personaName          String   @default("Assistant")
  systemPromptOverride String?
  bookingEnabled       Boolean  @default(true)
  collectPhotos        Boolean  @default(true)
  emergencyKeywords    String[] @default([])
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
}

model IntegrationSetting {
  id                String   @id @default(cuid())
  businessId        String   @unique
  twilioAccountSid  String?
  twilioAuthToken   String? // TODO: encrypt at rest before production
  twilioPhoneNumber String?
  whatsappNumber    String?
  stripeAccountId   String?
  googleCalendarId  String?
  googleMapsApiKey  String?
  zapierWebhookUrl  String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id         String   @id @default(cuid())
  businessId String?
  userId     String?
  action     String
  entityType String?
  entityId   String?
  metadata   Json?
  createdAt  DateTime @default(now())

  business Business? @relation(fields: [businessId], references: [id], onDelete: SetNull)
  user     User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([businessId])
}

enum BusinessStatus {
  ACTIVE
  SUSPENDED
  PENDING
}

model Review {
  id             String    @id @default(cuid())
  businessId     String
  business       Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  jobId          String?
  job            Job?      @relation(fields: [jobId], references: [id], onDelete: SetNull)
  customerId     String?
  customer       Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  rating         Int
  comment        String?
  source         String    @default("PUBLIC_FORM")
  routedToGoogle Boolean   @default(false)
  sentiment      String?
  themes         String[]
  analyzedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([businessId])
  @@index([jobId])
  @@index([customerId])
}
```

## API routes
```
appointments/[id]
appointments/reminders/run
appointments
auth/login
auth/logout
auth/me
auth/signup
billing/request-access
chat
conversations/[id]/messages
conversations/[id]
conversations
customers/[id]
customers
dashboard/jobs
digest/weekly
feedback
jobs/[id]/dispatch
jobs/[id]/request-review
jobs/[id]
jobs/[id]/suggest-tech
jobs
leads/scored
notifications/mark-read
notifications
onboarding
reports/jobs
reviews/analyze
services/[id]
services
settings
sms
super-admin/create-business
super-admin/delete-business
super-admin/set-business-status
super-admin/switch-business
technicians/[id]
technicians
voice/gather
voice
voice/status
```

## App pages
```
src/app/(app)/calendar/page.tsx
src/app/(app)/chatbot/page.tsx
src/app/(app)/customers/[id]/page.tsx
src/app/(app)/customers/new/page.tsx
src/app/(app)/customers/page.tsx
src/app/(app)/dashboard/page.tsx
src/app/(app)/inbox/page.tsx
src/app/(app)/jobs/[id]/page.tsx
src/app/(app)/jobs/new/page.tsx
src/app/(app)/jobs/page.tsx
src/app/(app)/reports/page.tsx
src/app/(app)/reviews/page.tsx
src/app/(app)/services/page.tsx
src/app/(app)/settings/page.tsx
src/app/(app)/super-admin/businesses/page.tsx
src/app/(app)/super-admin/new/page.tsx
src/app/(app)/super-admin/page.tsx
src/app/(app)/technicians/page.tsx
src/app/(app)/website-widget/page.tsx
src/app/billing/page.tsx
src/app/embed/[businessId]/page.tsx
src/app/feedback/[jobId]/page.tsx
src/app/login/page.tsx
src/app/onboarding/page.tsx
src/app/page.tsx
src/app/signup/page.tsx
src/app/suspended/page.tsx
```

## Components
```
CalendarView.tsx
ChatWidget.tsx
CustomerForm.tsx
DigestButton.tsx
DispatchPanel.tsx
EmbedChat.tsx
FeedbackForm.tsx
InboxClient.tsx
JobBoard.tsx
JobForm.tsx
NotificationBell.tsx
PipelineTiles.tsx
RemindersButton.tsx
ReviewInsights.tsx
ReviewsList.tsx
ServiceCatalog.tsx
SettingsForm.tsx
Sidebar.tsx
StatCards.tsx
TechnicianJobView.tsx
TechniciansManager.tsx
WidgetSnippet.tsx
```

## Lib modules
```
ai.ts
api-context.ts
appointments.ts
auth.ts
jwt.ts
leadScore.ts
notifications.ts
prisma.ts
rbac.ts
reviewInsights.ts
serviceCatalog.ts
techMatch.ts
twilio.ts
```

## Source inventory (lines of code)
```
     7 src/app/api/auth/logout/route.ts
     8 src/app/page.tsx
    13 src/lib/prisma.ts
    15 src/app/(app)/customers/new/page.tsx
    23 src/app/api/auth/me/route.ts
    27 src/app/api/billing/request-access/route.ts
    29 src/app/api/notifications/mark-read/route.ts
    29 src/app/billing/BillingSignOut.tsx
    33 src/app/api/notifications/route.ts
    33 src/app/layout.tsx
    35 src/app/api/super-admin/set-business-status/route.ts
    37 src/app/(app)/super-admin/SwitchBusinessButton.tsx
    37 src/app/suspended/page.tsx
    38 src/lib/notifications.ts
    40 src/lib/jwt.ts
    43 src/app/api/auth/login/route.ts
    44 src/app/api/super-admin/switch-business/route.ts
    44 src/app/embed/[businessId]/page.tsx
    46 src/app/api/voice/route.ts
    47 src/app/api/super-admin/delete-business/route.ts
    48 src/app/(app)/services/page.tsx
    50 src/app/(app)/website-widget/page.tsx
    52 src/app/(app)/inbox/page.tsx
    54 src/app/api/reviews/analyze/route.ts
    54 src/app/feedback/[jobId]/page.tsx
    57 src/app/billing/RequestAccessButton.tsx
    57 src/lib/auth.ts
    61 src/app/api/feedback/route.ts
    62 src/app/(app)/jobs/new/page.tsx
    62 src/app/(app)/settings/page.tsx
    62 src/lib/appointments.ts
    64 src/app/api/auth/signup/route.ts
    65 src/app/api/conversations/[id]/messages/route.ts
    65 src/components/RemindersButton.tsx
    66 src/lib/techMatch.ts
    69 src/app/api/leads/scored/route.ts
    70 src/app/(app)/technicians/page.tsx
    70 src/lib/api-context.ts
    71 src/app/api/customers/route.ts
    75 src/app/billing/page.tsx
    81 src/components/DigestButton.tsx
    82 src/app/(app)/chatbot/page.tsx
    82 src/app/api/jobs/[id]/suggest-tech/route.ts
    83 src/app/(app)/super-admin/page.tsx
    83 src/app/widget.js/route.ts
    88 src/app/(app)/calendar/page.tsx
    90 src/app/api/customers/[id]/route.ts
    90 src/lib/leadScore.ts
    91 src/app/(app)/reports/page.tsx
    92 src/lib/reviewInsights.ts
    93 src/app/(app)/layout.tsx
    93 src/app/api/dashboard/jobs/route.ts
    96 src/app/api/services/route.ts
   101 src/lib/twilio.ts
   106 src/app/(app)/customers/page.tsx
   106 src/components/WidgetSnippet.tsx
   107 src/app/api/conversations/[id]/route.ts
   107 src/app/api/jobs/[id]/request-review/route.ts
   109 src/app/login/page.tsx
   111 src/middleware.ts
   112 src/app/api/conversations/route.ts
   116 src/app/api/reports/jobs/route.ts
   118 src/lib/rbac.ts
   123 src/app/api/voice/status/route.ts
   126 src/app/api/jobs/[id]/dispatch/route.ts
   129 src/app/api/services/[id]/route.ts
   132 src/components/FeedbackForm.tsx
   133 src/app/api/digest/weekly/route.ts
   133 src/lib/serviceCatalog.ts
   134 src/app/signup/page.tsx
   137 src/components/JobBoard.tsx
   139 src/app/api/technicians/route.ts
   145 src/app/api/appointments/reminders/run/route.ts
   145 src/components/PipelineTiles.tsx
   148 src/app/(app)/reviews/page.tsx
   151 src/components/NotificationBell.tsx
   154 src/app/api/onboarding/route.ts
   159 src/app/api/super-admin/create-business/route.ts
   161 src/components/ReviewsList.tsx
   163 src/app/(app)/super-admin/businesses/BusinessAdminActions.tsx
   163 src/app/api/technicians/[id]/route.ts
   165 src/app/(app)/jobs/[id]/page.tsx
   169 src/app/(app)/super-admin/businesses/page.tsx
   174 src/app/api/appointments/route.ts
   176 src/components/DispatchPanel.tsx
   176 src/components/StatCards.tsx
   180 src/app/api/settings/route.ts
   180 src/components/TechnicianJobView.tsx
   184 src/app/(app)/customers/[id]/page.tsx
   185 src/app/(app)/jobs/page.tsx
   189 src/components/CustomerForm.tsx
   201 src/app/api/jobs/route.ts
   222 src/components/ReviewInsights.tsx
   230 src/app/api/appointments/[id]/route.ts
   232 src/components/EmbedChat.tsx
   238 src/app/api/jobs/[id]/route.ts
   240 src/components/ChatWidget.tsx
   282 src/components/Sidebar.tsx
   295 src/app/api/sms/route.ts
   295 src/lib/ai.ts
   296 src/app/api/voice/gather/route.ts
   297 src/app/api/chat/route.ts
   357 src/components/ServiceCatalog.tsx
   367 src/app/(app)/dashboard/page.tsx
   367 src/components/InboxClient.tsx
   367 src/components/SettingsForm.tsx
   408 src/components/TechniciansManager.tsx
   476 src/app/onboarding/page.tsx
   477 src/app/(app)/super-admin/new/page.tsx
   552 src/components/JobForm.tsx
   707 src/components/CalendarView.tsx
 15358 total
```

## Environment variables (names only, values redacted)
```
DATABASE_URL
JWT_EXPIRES_IN
JWT_SECRET
NEXT_PUBLIC_APP_URL
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
STRIPE_PRICE_ID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```
