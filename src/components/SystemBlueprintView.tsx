import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { SCRAPER_SERVICE_BLUEPRINT_CODE } from '../services/scraperService';
import { AGENT_ORCHESTRATOR_BLUEPRINT_CODE } from '../services/agentOrchestrator';
import { PUBLISHING_SERVICE_BLUEPRINT_CODE } from '../services/publishingService';

const PRISMA_SCHEMA_CODE = `// prisma/schema.prisma — TrendForge AI PostgreSQL Schema
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SourcePlatform {
  REDDIT
  QUORA
}

enum PostStatus {
  RAW
  PROCESSING
  GENERATED
}

enum ContentFormat {
  VIDEO_REEL
  IMAGE_CAROUSEL
}

enum AgentState {
  SCRIPTING
  AUDIO
  VISUALS
  RENDERING
  READY
  FAILED
}

enum SocialPlatform {
  TIKTOK
  INSTAGRAM
}

enum PublishMode {
  DIRECT
  DRAFT
}

enum PublishStatus {
  PENDING
  PUBLISHED
  ERROR
}

model ScrapedPost {
  id            String         @id @default(cuid())
  source        SourcePlatform
  externalId    String         @unique
  urlHash       String         @unique
  community     String
  title         String
  content       String         @db.Text
  topComments   Json
  upvotes       Int
  viralityScore Int
  scrapedAt     DateTime       @default(now())
  status        PostStatus     @default(RAW)
  jobs          ContentJob[]
}

model ContentJob {
  id          String        @id @default(cuid())
  postId      String
  post        ScrapedPost   @relation(fields: [postId], references: [id], onDelete: Cascade)
  format      ContentFormat
  agentState  AgentState    @default(SCRIPTING)
  scriptJson  Json?
  audioUrl    String?
  mediaUrls   String[]
  caption     String?       @db.Text
  logs        Json          @default("[]")
  publishLogs PublishLog[]
}

model SocialAccount {
  id           String         @id @default(cuid())
  platform     SocialPlatform
  accountName  String
  accessToken  String         @db.Text
  refreshToken String         @db.Text
  expiresAt    DateTime
}

model PublishLog {
  id                String         @id @default(cuid())
  jobId             String
  job               ContentJob     @relation(fields: [jobId], references: [id], onDelete: Cascade)
  platform          SocialPlatform
  publishMode       PublishMode    @default(DIRECT)
  externalPublishId String?
  status            PublishStatus  @default(PENDING)
  errorMessage      String?        @db.Text
  scheduledFor      DateTime?
}`;

const ARCHITECTURE_TREE = `trendforge-ai/
├── prisma/
│   └── schema.prisma                # PostgreSQL models: ScrapedPost, ContentJob, SocialAccount, PublishLog
├── src/
│   ├── app/                         # Next.js / Full-Stack UI & API Routes
│   │   ├── api/
│   │   │   ├── scrape/route.ts      # BullMQ enqueue & synchronous Reddit/Quora ingestion
│   │   │   ├── agent/run/route.ts   # 4-Agent Sequential Pipeline orchestrator
│   │   │   └── publish/route.ts     # TikTok v2 & Instagram Graph v21.0+ container publisher
│   ├── agents/
│   │   ├── scriptwriterAgent.ts     # Agent 1: Gemini 3.8 Flash structured JSON hook & script
│   │   ├── audioTimingAgent.ts      # Agent 2: ElevenLabs / Gemini TTS + forced word alignment
│   │   ├── visualDirectorAgent.ts   # Agent 3: 9:16 S3/R2 footage selector + Sharp 1080x1350 JPEG
│   │   └── remotionCompositor.tsx   # Agent 4: Remotion 1080x1920 60fps H.264 + karaoke captions
│   ├── workers/
│   │   ├── scraperWorker.ts         # Reddit OAuth2 + Playwright Stealth Quora GraphQL extractor
│   │   └── igContainerPoller.ts     # 5-second status_code === "FINISHED" polling worker
│   └── services/
│       └── socialPublisher.ts       # 24h OAuth2 refresh + DIRECT_POST / MEDIA_UPLOAD handlers`;

export const SystemBlueprintView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PRISMA' | 'SCRAPER' | 'AGENTS' | 'PUBLISHER'>('PRISMA');
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'PRISMA' as const, label: '01. Prisma Schema & Directory Tree', code: `${ARCHITECTURE_TREE}\n\n${PRISMA_SCHEMA_CODE}` },
    { id: 'SCRAPER' as const, label: '02. Module A: Reddit & Quora Scraper', code: SCRAPER_SERVICE_BLUEPRINT_CODE },
    { id: 'AGENTS' as const, label: '03. Module B: 4-Agent Pipeline & Remotion', code: AGENT_ORCHESTRATOR_BLUEPRINT_CODE },
    { id: 'PUBLISHER' as const, label: '04. Module C: TikTok v2 & IG v21.0+ Publisher', code: PUBLISHING_SERVICE_BLUEPRINT_CODE },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-display font-bold text-white">
            System Architecture & Production Modules
          </h2>
          <p className="text-sm text-white/65 mt-1">
            Complete reference implementations for PostgreSQL/Prisma, Playwright Stealth Quora ingestion, Remotion 60fps compositing, and 2026 TikTok/Instagram publishing APIs.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#12141D] hover:bg-white/10 text-white border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#00F0FF]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Module Code' : 'Copy Active Module'}</span>
        </button>
      </div>

      {/* Interactive Module Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#12141D] rounded-xl border border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                : 'text-white/65 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code Viewer */}
      <div className="rounded-xl bg-[#12141D]/90 border border-white/10 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-mono text-white/60">
          <span>{currentTab.label}</span>
          <span>TypeScript · Prisma · Remotion · BullMQ</span>
        </div>
        <pre className="p-5 text-xs font-mono text-white/85 overflow-x-auto leading-relaxed max-h-[640px]">
          <code>{currentTab.code}</code>
        </pre>
      </div>
    </div>
  );
};
