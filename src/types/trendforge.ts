export type SourcePlatform = 'REDDIT' | 'QUORA';
export type PostStatus = 'RAW' | 'PROCESSING' | 'GENERATED';
export type ContentFormat = 'VIDEO_REEL' | 'IMAGE_CAROUSEL';
export type FormatPreset =
  | 'REDDIT_STORY_GAMEPLAY'
  | 'AI_CINEMATIC_BROLL'
  | 'EDUCATIONAL_CAROUSEL_10';

export type AgentState =
  | 'SCRIPTING'
  | 'AUDIO'
  | 'VISUALS'
  | 'RENDERING'
  | 'READY'
  | 'FAILED';

export type SocialPlatform = 'TIKTOK' | 'INSTAGRAM';
export type PublishMode = 'DIRECT' | 'DRAFT';
export type PublishStatus = 'PENDING' | 'PUBLISHED' | 'ERROR';

export interface TopComment {
  id: string;
  author: string;
  body: string;
  score: number;
  role?: string;
}

export interface ScrapedPost {
  id: string;
  source: SourcePlatform;
  externalId: string;
  urlHash: string;
  community: string;
  author: string;
  title: string;
  content: string;
  topComments: TopComment[];
  upvotes: number;
  upvoteRatio: number;
  numComments: number;
  velocityPerHr: number;
  ageHours: number;
  viralityScore: number;
  velocityCategory: 'RISING' | 'HOT' | 'TOP_24H';
  scrapedAt: string;
  status: PostStatus;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface ScriptSegment {
  id: string;
  text: string;
  visual_prompt: string;
  emotion_tone: string;
  duration_estimate: number;
  slide_headline?: string;
  slide_bullet?: string;
}

export interface VideoPart {
  id: string;
  partNumber: number;
  title: string;
  prompt: string;
  narration: string;
  durationSec: number;
  status: 'PENDING' | 'GENERATING' | 'READY';
  engine: 'GOOGLE_OMNI' | 'FLOW_CONNECTOR';
  videoDataUrl?: string | null;
  interactionId?: string;
}

export interface ScriptOutput {
  scroll_stopping_hook: string;
  script_segments: ScriptSegment[];
  caption: string;
  hashtags: string[];
  words: WordTimestamp[];
  total_duration: number;
  video_parts?: VideoPart[];
  combined_video_ready?: boolean;
  combined_video_url?: string | null;
}

export interface AgentLogEntry {
  timestamp: string;
  agent: 'AGENT_1_SCRIPT' | 'AGENT_2_AUDIO' | 'AGENT_3_VISUALS' | 'AGENT_4_COMPOSITOR';
  message: string;
  detail?: string;
}

export interface ContentJob {
  id: string;
  postId: string;
  postTitle: string;
  community: string;
  source: SourcePlatform;
  format: ContentFormat;
  preset: FormatPreset;
  agentState: AgentState;
  scriptJson: ScriptOutput | null;
  audioUrl: string | null;
  audioBase64?: string | null;
  mediaUrls: string[];
  caption: string;
  logs: AgentLogEntry[];
  createdAt: string;
}

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  externalId: string;
  connected: boolean;
  scopes: string[];
  expiresAt: string;
  tokenStatus: 'VALID' | 'REFRESH_DUE';
  authMethod?: 'OAUTH_POPUP' | 'SANDBOX_TOKEN';
}

export interface PublishLog {
  id: string;
  jobId: string;
  platform: SocialPlatform;
  publishMode: PublishMode;
  externalPublishId: string;
  directViewUrl?: string;
  platformPostUrl?: string;
  status: PublishStatus;
  errorMessage?: string;
  containerSteps?: {
    step: string;
    endpoint: string;
    status: string;
    timestamp: string;
  }[];
  privacyLevel?: string;
  isAigc?: boolean;
  createdAt: string;
}
