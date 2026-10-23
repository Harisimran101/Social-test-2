import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Link2,
  Sparkles,
  Film,
  Eye,
  Copy,
  Check,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import {
  INITIAL_SCRAPED_POSTS,
  INITIAL_SOCIAL_ACCOUNTS,
} from './data/initialPosts';
import { buildFallbackScript } from './services/agentOrchestrator';
import { AgentStudioDrawer } from './components/AgentStudioDrawer';
import { ReelCanvasPreview } from './components/ReelCanvasPreview';
import { SystemBlueprintView } from './components/SystemBlueprintView';
import type {
  ContentJob,
  FormatPreset,
  PublishLog,
  PublishMode,
  ScrapedPost,
  ScriptOutput,
  SocialAccount,
  SocialPlatform,
} from './types/trendforge';

type ActiveNavTab = 'RADAR' | 'QUEUE' | 'ACCOUNTS' | 'BLUEPRINT' | 'DIRECT_WATCH';
type SourceFilter = 'ALL' | 'REDDIT' | 'QUORA';

export default function App() {
  const [activeNav, setActiveNav] = useState<ActiveNavTab>('RADAR');
  const [posts, setPosts] = useState<ScrapedPost[]>(INITIAL_SCRAPED_POSTS);
  const [accounts, setAccounts] = useState<SocialAccount[]>(INITIAL_SOCIAL_ACCOUNTS);
  const [jobs, setJobs] = useState<ContentJob[]>([]);
  const [publishLogs, setPublishLogs] = useState<PublishLog[]>([]);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customSubreddit, setCustomSubreddit] = useState<string>('');
  const [isScraping, setIsScraping] = useState<boolean>(false);

  const [studioOpen, setStudioOpen] = useState<boolean>(false);
  const [activeStudioPostId, setActiveStudioPostId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);

  // Direct Video Watch state
  const [directWatchJobId, setDirectWatchJobId] = useState<string | null>(null);
  const [directWatchLog, setDirectWatchLog] = useState<PublishLog | null>(null);
  const [copiedDirectUrl, setCopiedDirectUrl] = useState<boolean>(false);
  const [watchAudioBase64, setWatchAudioBase64] = useState<string | null>(null);
  const [isWatchSynthesizing, setIsWatchSynthesizing] = useState<boolean>(false);

  const refreshServerState = () => {
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.posts) && data.posts.length > 0) setPosts(data.posts);
        if (Array.isArray(data.accounts)) setAccounts(data.accounts);
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (Array.isArray(data.publishLogs)) setPublishLogs(data.publishLogs);

        // Check if URL has ?watch=<jobId>
        const params = new URLSearchParams(window.location.search);
        const watchParam = params.get('watch');
        if (watchParam) {
          setDirectWatchJobId(watchParam);
          setActiveNav('DIRECT_WATCH');
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshServerState();
  }, []);

  // Listen for OAuth2 Popup Completion (OAUTH_AUTH_SUCCESS)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        refreshServerState();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAuthenticatePlatform = async (platform: SocialPlatform) => {
    try {
      const res = await fetch(`/api/auth/${platform.toLowerCase()}/url`);
      if (!res.ok) return;
      const { url } = await res.json();
      const popup = window.open(url, `${platform}_oauth_popup`, 'width=560,height=680');
      if (!popup) {
        await fetch('/api/accounts/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: platform === 'TIKTOK' ? 'acc-tiktok-1' : 'acc-ig-1',
            action: 'REFRESH',
          }),
        });
        refreshServerState();
      }
    } catch {
      refreshServerState();
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (sourceFilter !== 'ALL' && post.source !== sourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          post.title.toLowerCase().includes(q) ||
          post.content.toLowerCase().includes(q) ||
          post.community.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [posts, sourceFilter, searchQuery]);

  const handleLiveScrape = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsScraping(true);
    const comm = customSubreddit.trim() || 'r/LocalLLaMA';
    const src = comm.toLowerCase().startsWith('quora') ? 'QUORA' : 'REDDIT';

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community: comm, source: src }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.posts)) setPosts(data.posts);
        setCustomSubreddit('');
      }
    } finally {
      setIsScraping(false);
    }
  };

  const handleIgnitePipeline = async (
    post: ScrapedPost,
    preset: FormatPreset = 'REDDIT_STORY_GAMEPLAY'
  ) => {
    setActiveStudioPostId(post.id);
    setStudioOpen(true);
    setIsRunningPipeline(true);

    const optimisticScript = buildFallbackScript(post, preset);
    const optimisticJob: ContentJob = {
      id: `job-local-${post.id}`,
      postId: post.id,
      postTitle: post.title,
      community: post.community,
      source: post.source,
      format: preset === 'EDUCATIONAL_CAROUSEL_10' ? 'IMAGE_CAROUSEL' : 'VIDEO_REEL',
      preset,
      agentState: 'READY',
      scriptJson: optimisticScript,
      audioUrl: `https://pub-r2.trendforge.ai/audio/${post.id}.wav`,
      mediaUrls: [`https://pub-r2.trendforge.ai/reels/${post.id}_1080x1920_60fps.mp4`],
      caption: `${optimisticScript.caption} ${optimisticScript.hashtags.join(' ')}`,
      logs: [],
      createdAt: new Date().toISOString(),
    };
    setJobs((prev) => [optimisticJob, ...prev.filter((j) => j.postId !== post.id)]);
    setActiveJobId(optimisticJob.id);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, preset }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setJobs((prev) => [
            data.job,
            ...prev.filter((j) => j.id !== optimisticJob.id && j.id !== data.job.id),
          ]);
          setActiveJobId(data.job.id);
        }
        if (Array.isArray(data.posts)) setPosts(data.posts);
      }
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const handleUpdateJobScript = (jobId: string, updatedScript: ScriptOutput) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, scriptJson: updatedScript } : j))
    );
  };

  const handleJobUpdated = (updatedJob: ContentJob) => {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  };

  const handlePublishJob = async (params: {
    jobId: string;
    platform: SocialPlatform;
    publishMode: PublishMode;
    privacyLevel: string;
    isAigc: boolean;
  }) => {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.publishLogs)) setPublishLogs(data.publishLogs);
    }
  };

  // Open Direct Video Watch Page
  const handleOpenDirectView = (jobId: string, log?: PublishLog) => {
    setDirectWatchJobId(jobId);
    if (log) setDirectWatchLog(log);
    setStudioOpen(false);
    setActiveNav('DIRECT_WATCH');
    const newUrl = `${window.location.pathname}?watch=${encodeURIComponent(jobId)}${
      log ? `&platform=${log.platform}&pubId=${log.externalPublishId}` : ''
    }`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const activeStudioPost = useMemo(
    () => posts.find((p) => p.id === activeStudioPostId) || null,
    [posts, activeStudioPostId]
  );

  const activeJob = useMemo(
    () =>
      jobs.find((j) => j.id === activeJobId) ||
      jobs.find((j) => j.postId === activeStudioPostId) ||
      null,
    [jobs, activeJobId, activeStudioPostId]
  );

  // Resolve Direct Watch Job & Post
  const directWatchJob = useMemo(() => {
    const found = jobs.find((j) => j.id === directWatchJobId) || jobs[0];
    if (found) return found;
    // Fallback if opened via direct URL before any job was created
    const defaultPost = posts[0];
    const fallbackScript = buildFallbackScript(defaultPost, 'REDDIT_STORY_GAMEPLAY');
    return {
      id: directWatchJobId || 'job-demo-watch',
      postId: defaultPost.id,
      postTitle: defaultPost.title,
      community: defaultPost.community,
      source: defaultPost.source,
      format: 'VIDEO_REEL' as const,
      preset: 'REDDIT_STORY_GAMEPLAY' as const,
      agentState: 'READY' as const,
      scriptJson: fallbackScript,
      audioUrl: null,
      mediaUrls: [],
      caption: `${fallbackScript.caption} ${fallbackScript.hashtags.join(' ')}`,
      logs: [],
      createdAt: new Date().toISOString(),
    };
  }, [jobs, directWatchJobId, posts]);

  const directWatchPost = useMemo(
    () => posts.find((p) => p.id === directWatchJob?.postId) || posts[0],
    [posts, directWatchJob]
  );

  const shareableDirectUrl = useMemo(() => {
    const rel =
      directWatchLog?.directViewUrl ||
      `/?watch=${encodeURIComponent(directWatchJob.id)}${
        directWatchLog ? `&platform=${directWatchLog.platform}&pubId=${directWatchLog.externalPublishId}` : ''
      }`;
    return `${window.location.origin}${rel}`;
  }, [directWatchJob, directWatchLog]);

  const handleSynthesizeWatchAudio = async (voiceName: string) => {
    if (!directWatchJob?.scriptJson) return;
    setIsWatchSynthesizing(true);
    const fullNarration = [
      directWatchJob.scriptJson.scroll_stopping_hook,
      ...directWatchJob.scriptJson.script_segments.map((s) => s.text),
    ].join('. ');
    try {
      const res = await fetch('/api/agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullNarration, voiceName }),
      });
      const data = await res.json();
      if (data.audioBase64) setWatchAudioBase64(data.audioBase64);
    } finally {
      setIsWatchSynthesizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6] flex flex-col">
      {/* Top Bar Contract: 3 Clean Zones */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-[#090A0F]/95 backdrop-blur-md border-b border-white/[0.08]">
        <a
          href="#radar"
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState({}, '', window.location.pathname);
            setActiveNav('RADAR');
          }}
          className="text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          TrendForge AI
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/65">
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', window.location.pathname);
              setActiveNav('RADAR');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'RADAR'
                ? 'text-white border-[#00F0FF]'
                : 'border-transparent hover:text-white'
            }`}
          >
            1. Trending Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('QUEUE')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'QUEUE' || activeNav === 'DIRECT_WATCH'
                ? 'text-white border-[#00F0FF]'
                : 'border-transparent hover:text-white'
            }`}
          >
            2. Generated Videos ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('ACCOUNTS')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'ACCOUNTS'
                ? 'text-white border-[#00F0FF]'
                : 'border-transparent hover:text-white'
            }`}
          >
            3. TikTok & Instagram Auth
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('BLUEPRINT')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'BLUEPRINT'
                ? 'text-white border-[#00F0FF]'
                : 'border-transparent hover:text-white'
            }`}
          >
            System Code
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => handleLiveScrape()}
            disabled={isScraping}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#090A0F] bg-[#00F0FF] hover:bg-[#00D6E4] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
            <span>{isScraping ? 'Fetching...' : 'Fetch New Trends'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8">
        {activeNav === 'DIRECT_WATCH' && directWatchJob && directWatchJob.scriptJson && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', window.location.pathname);
                  setActiveNav('RADAR');
                }}
                className="flex items-center gap-2 text-xs font-semibold text-white/75 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Feed</span>
              </button>

              <span className="text-xs font-mono text-[#00F0FF] tabular-nums">
                DIRECT VIDEO VIEW · {directWatchLog?.platform || 'PUBLISHED'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start p-6 rounded-2xl bg-[#12141D] border border-white/10">
              <div className="md:col-span-5">
                <ReelCanvasPreview
                  post={directWatchPost}
                  preset={directWatchJob.preset}
                  script={directWatchJob.scriptJson}
                  audioBase64={watchAudioBase64}
                  onSynthesizeAudio={handleSynthesizeWatchAudio}
                  isSynthesizingAudio={isWatchSynthesizing}
                />
              </div>

              <div className="md:col-span-7 space-y-5">
                <div>
                  <div className="text-xs font-mono text-[#00F0FF]">
                    {directWatchPost.community} · {directWatchJob.scriptJson.script_segments.length} Combined Video Parts
                  </div>
                  <h1 className="text-xl font-display font-bold text-white mt-1">
                    {directWatchJob.postTitle}
                  </h1>
                  <p className="text-sm text-white/75 mt-2 leading-relaxed">
                    {directWatchJob.caption}
                  </p>
                </div>

                {/* Shareable Direct View Link Box */}
                <div className="p-4 rounded-xl bg-[#090A0F] border border-[#00F0FF]/30 space-y-2.5">
                  <div className="text-xs font-semibold text-white">
                    Direct View Link
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareableDirectUrl}
                      className="flex-1 bg-[#12141D] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-[#00F0FF] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(shareableDirectUrl);
                        setCopiedDirectUrl(true);
                        setTimeout(() => setCopiedDirectUrl(false), 1800);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#090A0F] cursor-pointer shrink-0"
                    >
                      {copiedDirectUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Direct Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {directWatchLog?.platformPostUrl && (
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-white/60 font-mono">
                        Platform Permalink:
                      </span>
                      <a
                        href={directWatchLog.platformPostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[#00F0FF] hover:underline font-mono"
                      >
                        <span>{directWatchLog.platformPostUrl}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Combined Parts Breakdown */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/75">
                    Combined Video Parts ({directWatchJob.scriptJson.script_segments.length})
                  </div>
                  {directWatchJob.scriptJson.script_segments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="p-3 rounded-xl bg-[#090A0F] border border-white/10 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[#00F0FF]">
                        <span>Part 0{idx + 1}: {seg.emotion_tone}</span>
                        <span>{seg.duration_estimate}s</span>
                      </div>
                      <p className="text-white/80">{seg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeNav === 'RADAR' && (
          <div className="space-y-6">
            {/* Simple 3-Step Visual Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#12141D] border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  01
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Pick a Trending Post
                  </div>
                  <div className="text-[11px] text-white/55">
                    Scraped live from Reddit & Quora
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#8A2BE2]/20 text-[#00F0FF] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  02
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Generate Video in Parts & Combine
                  </div>
                  <div className="text-[11px] text-white/55">
                    Flow Connect + Multi-Part 9:16 Video Stitcher
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  03
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Authenticate, Post & Direct Link
                  </div>
                  <div className="text-[11px] text-white/55">
                    OAuth publish to TikTok & IG with instant watch link
                  </div>
                </div>
              </div>
            </div>

            {/* Simple Filter & Scrape Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 p-1 bg-[#12141D] rounded-xl border border-white/10 self-start">
                {(['ALL', 'REDDIT', 'QUORA'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      sourceFilter === src
                        ? 'bg-[#00F0FF] text-[#090A0F]'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    {src === 'ALL'
                      ? 'All Sources'
                      : src === 'REDDIT'
                      ? 'Reddit Threads'
                      : 'Quora Questions'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts..."
                    className="w-full bg-[#12141D] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>

                <form onSubmit={handleLiveScrape} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSubreddit}
                    onChange={(e) => setCustomSubreddit(e.target.value)}
                    placeholder="e.g. r/artificial or Quora..."
                    className="w-44 bg-[#12141D] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#00F0FF]"
                  />
                  <button
                    type="submit"
                    disabled={isScraping}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                  >
                    Scrape
                  </button>
                </form>
              </div>
            </div>

            {/* Clean 2-Column Grid of Trend Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl bg-[#12141D]/85 border border-white/[0.08] hover:border-white/20 transition-colors p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-white/60">
                      <div>
                        <span className="text-[#00F0FF] font-semibold">
                          {post.community}
                        </span>
                        <span> · {post.upvotes.toLocaleString()} upvotes</span>
                        <span> · +{post.velocityPerHr}/hr</span>
                      </div>
                      <span className="text-[#00F0FF] font-semibold">
                        Score {post.viralityScore}/100
                      </span>
                    </div>

                    <h2 className="text-lg font-display font-bold text-white leading-snug">
                      {post.title}
                    </h2>

                    <p className="text-sm text-[#9CA3AF] leading-relaxed line-clamp-3">
                      {post.content}
                    </p>
                  </div>

                  {post.topComments[0] && (
                    <div className="p-3 rounded-xl bg-[#090A0F]/80 border border-white/[0.06] text-xs">
                      <div className="font-mono text-[11px] text-white/50 mb-1">
                        Top Comment ({post.topComments[0].author} · +{post.topComments[0].score})
                      </div>
                      <p className="text-white/80 line-clamp-2">
                        {post.topComments[0].body}
                      </p>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-white/50 tabular-nums">
                      {post.numComments} comments · {post.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleIgnitePipeline(post, 'REDDIT_STORY_GAMEPLAY')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#8A2BE2] hover:bg-[#7B22CC] text-white shadow-lg shadow-[#8A2BE2]/25 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create Multi-Part Video</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeNav === 'QUEUE' && (
          <div className="space-y-5">
            <h2 className="text-xl font-display font-bold text-white">
              Generated Multi-Part Videos & Direct View Links
            </h2>
            {jobs.length === 0 ? (
              <div className="p-10 rounded-2xl bg-[#12141D] border border-white/10 text-center space-y-3">
                <p className="text-sm text-white/70">
                  No videos generated yet. Pick any trending post to generate and combine video parts.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('RADAR');
                    if (posts[0]) handleIgnitePipeline(posts[0]);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#8A2BE2] text-white cursor-pointer"
                >
                  Generate Sample Video Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => {
                  const jobLogs = publishLogs.filter((l) => l.jobId === job.id);
                  return (
                    <div
                      key={job.id}
                      className="p-5 rounded-2xl bg-[#12141D] border border-white/10 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs font-mono text-[#00F0FF] tabular-nums">
                          {job.community} · {job.scriptJson?.script_segments.length || 4} Parts Combined
                        </div>
                        <h3 className="text-base font-display font-bold text-white mt-1">
                          {job.postTitle}
                        </h3>
                        <p className="text-xs text-white/60 mt-1 line-clamp-2">
                          {job.caption}
                        </p>
                      </div>

                      {jobLogs.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#090A0F] border border-[#00F0FF]/30 text-xs space-y-1.5">
                          <div className="text-[#00F0FF] font-semibold">
                            Published on {jobLogs[0].platform}
                          </div>
                          <div className="font-mono text-[11px] text-white/75 truncate">
                            {window.location.origin}
                            {jobLogs[0].directViewUrl}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDirectView(job.id, jobLogs[0])}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Direct Video View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveStudioPostId(job.postId);
                            setActiveJobId(job.id);
                            setStudioOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#090A0F] cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Edit & Post</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeNav === 'ACCOUNTS' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-white">
                TikTok & Instagram OAuth2 Authentication
              </h2>
              <p className="text-sm text-white/60 mt-1">
                Authenticate your accounts to publish generated 9:16 videos and slide carousels directly from TrendForge AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-6 rounded-2xl bg-[#12141D] border border-white/10 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-[#00F0FF]">
                        {acc.platform} OFFICIAL API
                      </div>
                      <h3 className="text-lg font-display font-bold text-white mt-0.5">
                        {acc.accountName}
                      </h3>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-mono text-[#00F0FF]">
                      <CheckCircle2 className="w-4 h-4" />
                      {acc.connected ? 'AUTHENTICATED' : 'DISCONNECTED'}
                    </span>
                  </div>

                  <div className="text-xs font-mono text-white/60 space-y-1 tabular-nums">
                    <div>Scopes: {acc.scopes.join(', ')}</div>
                    <div>Expires: {new Date(acc.expiresAt).toLocaleString()}</div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleAuthenticatePlatform(acc.platform)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#00F0FF] text-[#090A0F] hover:bg-[#00D6E4] transition-colors cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Authenticate with {acc.platform} OAuth</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === 'BLUEPRINT' && <SystemBlueprintView />}
      </main>

      {/* Studio Slide-Over Drawer */}
      <AgentStudioDrawer
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        post={activeStudioPost}
        activeJob={activeJob}
        isRunningPipeline={isRunningPipeline}
        onRunPipeline={handleIgnitePipeline}
        onUpdateJobScript={handleUpdateJobScript}
        onJobUpdated={handleJobUpdated}
        accounts={accounts}
        onAuthenticatePlatform={handleAuthenticatePlatform}
        onPublishJob={handlePublishJob}
        publishLogs={publishLogs}
        onOpenDirectView={handleOpenDirectView}
      />
    </div>
  );
}
