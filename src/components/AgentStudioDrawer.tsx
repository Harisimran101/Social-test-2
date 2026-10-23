import React, { useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  Send,
  CheckCircle2,
  Film,
  Link2,
  ExternalLink,
  Copy,
  Check,
  Eye,
} from 'lucide-react';
import { ReelCanvasPreview } from './ReelCanvasPreview';
import { buildWordTimestamps } from '../services/agentOrchestrator';
import type {
  ContentJob,
  FormatPreset,
  PublishLog,
  PublishMode,
  ScrapedPost,
  ScriptOutput,
  SocialAccount,
  SocialPlatform,
} from '../types/trendforge';

interface AgentStudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  post: ScrapedPost | null;
  activeJob: ContentJob | null;
  isRunningPipeline: boolean;
  onRunPipeline: (post: ScrapedPost, preset: FormatPreset) => void;
  onUpdateJobScript: (jobId: string, updatedScript: ScriptOutput) => void;
  onJobUpdated: (updatedJob: ContentJob) => void;
  accounts: SocialAccount[];
  onAuthenticatePlatform: (platform: SocialPlatform) => Promise<void>;
  onPublishJob: (params: {
    jobId: string;
    platform: SocialPlatform;
    publishMode: PublishMode;
    privacyLevel: string;
    isAigc: boolean;
  }) => Promise<void>;
  publishLogs: PublishLog[];
  onOpenDirectView: (jobId: string, log: PublishLog) => void;
}

export const AgentStudioDrawer: React.FC<AgentStudioDrawerProps> = ({
  isOpen,
  onClose,
  post,
  activeJob,
  isRunningPipeline,
  onRunPipeline,
  onUpdateJobScript,
  onJobUpdated,
  accounts,
  onAuthenticatePlatform,
  onPublishJob,
  publishLogs,
  onOpenDirectView,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<FormatPreset>(
    activeJob?.preset || 'REDDIT_STORY_GAMEPLAY'
  );
  const [videoEngine, setVideoEngine] = useState<'GOOGLE_OMNI' | 'FLOW_CONNECTOR'>('FLOW_CONNECTOR');
  const [isGeneratingParts, setIsGeneratingParts] = useState<boolean>(false);
  const [flowStatus, setFlowStatus] = useState<{
    connected: boolean;
    rawOutput: string;
  } | null>(null);

  const [publishMode, setPublishMode] = useState<PublishMode>('DIRECT');
  const [isPublishingPlatform, setIsPublishingPlatform] = useState<SocialPlatform | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<SocialPlatform | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState<boolean>(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/flow/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setFlowStatus(data);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen || !post) return null;

  const script = activeJob?.scriptJson;
  const jobPublishLogs = publishLogs.filter((l) => l.jobId === activeJob?.id);

  const tiktokAccount = accounts.find((a) => a.platform === 'TIKTOK');
  const instagramAccount = accounts.find((a) => a.platform === 'INSTAGRAM');

  const handlePresetSwitch = (preset: FormatPreset) => {
    setSelectedPreset(preset);
    setAudioBase64(null);
    onRunPipeline(post, preset);
  };

  const handleGenerateAndCombineParts = async () => {
    if (!activeJob) return;
    setIsGeneratingParts(true);
    try {
      const res = await fetch('/api/video/generate-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: activeJob.id,
          engine: videoEngine,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          onJobUpdated(data.job);
        }
      }
    } finally {
      setIsGeneratingParts(false);
    }
  };

  const handleSegmentTextChange = (segId: string, newText: string) => {
    if (!activeJob || !script) return;
    const updatedSegments = script.script_segments.map((s) =>
      s.id === segId ? { ...s, text: newText } : s
    );
    const { words, totalDuration } = buildWordTimestamps(updatedSegments);
    onUpdateJobScript(activeJob.id, {
      ...script,
      script_segments: updatedSegments,
      words,
      total_duration: totalDuration,
    });
  };

  const handleSynthesizeVoiceover = async (voiceName: string) => {
    if (!script) return;
    setIsSynthesizingAudio(true);
    const fullNarration = [
      script.scroll_stopping_hook,
      ...script.script_segments.map((s) => s.text),
    ].join('. ');

    try {
      const res = await fetch('/api/agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullNarration, voiceName }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        setAudioBase64(data.audioBase64);
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(fullNarration.slice(0, 320));
        utter.rate = 1.08;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(fullNarration.slice(0, 320));
        utter.rate = 1.08;
        window.speechSynthesis.speak(utter);
      }
    } finally {
      setIsSynthesizingAudio(false);
    }
  };

  const handleOAuthClick = async (platform: SocialPlatform) => {
    setIsAuthenticating(platform);
    try {
      await onAuthenticatePlatform(platform);
    } finally {
      setIsAuthenticating(null);
    }
  };

  const handleTriggerPublish = async (platform: SocialPlatform) => {
    if (!activeJob) return;
    setIsPublishingPlatform(platform);
    try {
      await onPublishJob({
        jobId: activeJob.id,
        platform,
        publishMode,
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        isAigc: true,
      });
    } finally {
      setIsPublishingPlatform(null);
    }
  };

  const getFullDirectLink = (plog: PublishLog) => {
    const rel =
      plog.directViewUrl ||
      `/?watch=${encodeURIComponent(plog.jobId)}&platform=${plog.platform}&pubId=${plog.externalPublishId}`;
    return `${window.location.origin}${rel}`;
  };

  const handleCopyDirectLink = (plog: PublishLog) => {
    const fullUrl = getFullDirectLink(plog);
    navigator.clipboard.writeText(fullUrl);
    setCopiedLogId(plog.id);
    setTimeout(() => setCopiedLogId(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-[920px] h-full bg-[#090A0F] border-l border-white/10 flex flex-col overflow-hidden shadow-2xl">
        {/* Clean Header */}
        <div className="px-6 py-4 bg-[#12141D] border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-[#00F0FF] tabular-nums">
              {post.community} · Viral Score {post.viralityScore}/100
            </div>
            <h2 className="text-base font-display font-bold text-white truncate mt-0.5">
              {post.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/75 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Simple, Easy-to-Use Studio Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12141D] p-3 rounded-xl border border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'REDDIT_STORY_GAMEPLAY', label: '9:16 Story + Gameplay' },
                  { id: 'AI_CINEMATIC_BROLL', label: '9:16 AI Cinematic Reel' },
                  { id: 'EDUCATIONAL_CAROUSEL_10', label: '4:5 Slide Carousel (.JPG)' },
                ] as const
              ).map((opt) => {
                const active = (activeJob?.preset || selectedPreset) === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePresetSwitch(opt.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#00F0FF] text-[#090A0F]'
                        : 'bg-[#090A0F] text-white/70 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onRunPipeline(post, selectedPreset)}
              disabled={isRunningPipeline}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningPipeline ? 'animate-spin' : ''}`} />
              <span>Regenerate Script</span>
            </button>
          </div>

          {script && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (7 cols): Step 1 — Multi-Part Video Generator & Script Editor */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-4 rounded-xl bg-[#12141D] border border-white/10 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
                        <Film className="w-4 h-4 text-[#00F0FF]" />
                        Step 1: Generate Video in Parts & Combine
                      </h3>
                      <p className="text-xs text-white/60 mt-0.5">
                        Generates each scene part with Flow Connector (`flow-auto`) or Google Omni and merges them into one continuous 9:16 video.
                      </p>
                    </div>
                  </div>

                  {/* Engine Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 bg-[#090A0F] p-1 rounded-lg border border-white/10">
                      <button
                        type="button"
                        onClick={() => setVideoEngine('FLOW_CONNECTOR')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                          videoEngine === 'FLOW_CONNECTOR'
                            ? 'bg-[#8A2BE2] text-white'
                            : 'text-white/65 hover:text-white'
                        }`}
                      >
                        Flow Connector (`flow-auto`)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoEngine('GOOGLE_OMNI')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                          videoEngine === 'GOOGLE_OMNI'
                            ? 'bg-[#8A2BE2] text-white'
                            : 'text-white/65 hover:text-white'
                        }`}
                      >
                        Google Omni (`gemini-omni-1.1-flash`)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAndCombineParts}
                      disabled={isGeneratingParts}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#8A2BE2] hover:bg-[#7B22CC] text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isGeneratingParts ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isGeneratingParts
                          ? 'Generating & Combining Parts...'
                          : `Generate ${script.script_segments.length} Parts & Combine`}
                      </span>
                    </button>
                  </div>

                  {videoEngine === 'FLOW_CONNECTOR' && flowStatus && (
                    <div className="p-2.5 rounded-lg bg-[#090A0F] border border-white/10 text-xs font-mono text-white/75 flex items-center justify-between gap-2">
                      <span className="truncate">{flowStatus.rawOutput}</span>
                      <a
                        href="https://flow.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[#00F0FF] hover:underline shrink-0"
                      >
                        <span>Open Flow</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* The 4 Video Parts List */}
                  <div className="space-y-2.5 pt-1">
                    {script.script_segments.map((seg, idx) => (
                      <div
                        key={seg.id}
                        className="p-3 rounded-xl bg-[#090A0F] border border-white/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-[#00F0FF] font-semibold">
                            Part 0{idx + 1}: {seg.emotion_tone}
                          </span>
                          <span className="text-white/60">
                            {seg.duration_estimate}s · Merged in Timeline
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          value={seg.text}
                          onChange={(e) => handleSegmentTextChange(seg.id, e.target.value)}
                          className="w-full bg-[#12141D] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
                        />
                        <div className="text-[11px] font-mono text-white/45 truncate">
                          Scene Prompt: {seg.visual_prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Step 2 Preview + Step 3 Authenticate, Post & Direct View Link */}
              <div className="lg:col-span-5 space-y-5">
                <div className="p-4 rounded-xl bg-[#12141D] border border-white/10">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-display font-bold text-white">
                      Step 2: Combined 9:16 Video Preview
                    </span>
                    <span className="font-mono text-[11px] text-[#00F0FF] tabular-nums">
                      {script.script_segments.length} Parts Combined
                    </span>
                  </div>

                  <ReelCanvasPreview
                    post={post}
                    preset={activeJob?.preset || selectedPreset}
                    script={script}
                    audioBase64={audioBase64}
                    onSynthesizeAudio={handleSynthesizeVoiceover}
                    isSynthesizingAudio={isSynthesizingAudio}
                  />
                </div>

                {/* Step 3: Authenticate & Post to TikTok / Instagram + Direct View Link */}
                <div className="p-4 rounded-xl bg-[#12141D] border border-white/10 space-y-4">
                  <div>
                    <h3 className="text-sm font-display font-bold text-white">
                      Step 3: Authenticate & Post Content
                    </h3>
                    <p className="text-xs text-white/60 mt-0.5">
                      Connect your TikTok and Instagram accounts via OAuth2, publish, and get a direct view link immediately.
                    </p>
                  </div>

                  {/* TikTok Auth + Post Row */}
                  <div className="p-3 rounded-xl bg-[#090A0F] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">TikTok</span>
                        <span className="ml-2 font-mono text-[11px] text-white/60">
                          {tiktokAccount?.connected
                            ? tiktokAccount.accountName
                            : 'Not Authenticated'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOAuthClick('TIKTOK')}
                        disabled={isAuthenticating === 'TIKTOK'}
                        className="flex items-center gap-1 text-xs font-medium text-[#00F0FF] hover:underline cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>
                          {isAuthenticating === 'TIKTOK'
                            ? 'Opening OAuth...'
                            : tiktokAccount?.connected
                            ? 'Re-Authenticate'
                            : 'Authenticate TikTok'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={publishMode}
                        onChange={(e) => setPublishMode(e.target.value as PublishMode)}
                        className="bg-[#12141D] text-white text-xs border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none"
                      >
                        <option value="DIRECT">Direct Post (Public)</option>
                        <option value="DRAFT">Send to TikTok Inbox Draft</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleTriggerPublish('TIKTOK')}
                        disabled={!tiktokAccount?.connected || isPublishingPlatform !== null}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-[#00F0FF] hover:bg-[#00D6E4] text-[#090A0F] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isPublishingPlatform === 'TIKTOK'
                            ? 'Posting...'
                            : 'Post to TikTok'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Instagram Auth + Post Row */}
                  <div className="p-3 rounded-xl bg-[#090A0F] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">Instagram Reels</span>
                        <span className="ml-2 font-mono text-[11px] text-white/60">
                          {instagramAccount?.connected
                            ? instagramAccount.accountName
                            : 'Not Authenticated'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOAuthClick('INSTAGRAM')}
                        disabled={isAuthenticating === 'INSTAGRAM'}
                        className="flex items-center gap-1 text-xs font-medium text-[#00F0FF] hover:underline cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>
                          {isAuthenticating === 'INSTAGRAM'
                            ? 'Opening OAuth...'
                            : instagramAccount?.connected
                            ? 'Re-Authenticate'
                            : 'Authenticate Instagram'}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTriggerPublish('INSTAGRAM')}
                      disabled={!instagramAccount?.connected || isPublishingPlatform !== null}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-[#8A2BE2] hover:bg-[#7B22CC] text-white transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isPublishingPlatform === 'INSTAGRAM'
                          ? 'Publishing to Instagram...'
                          : 'Post to Instagram Reels'}
                      </span>
                    </button>
                  </div>

                  {/* Direct View Link Cards after Posting */}
                  {jobPublishLogs.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="text-xs font-semibold text-[#00F0FF]">
                        Published — Direct View Links
                      </div>
                      {jobPublishLogs.map((plog) => {
                        const fullDirectUrl = getFullDirectLink(plog);
                        return (
                          <div
                            key={plog.id}
                            className="p-3.5 rounded-xl bg-[#090A0F] border border-[#00F0FF]/40 space-y-2.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-[#00F0FF] font-semibold">
                                <CheckCircle2 className="w-4 h-4" />
                                Live on {plog.platform} ({plog.publishMode})
                              </span>
                              <span className="font-mono text-[11px] text-white/55 tabular-nums">
                                ID: {plog.externalPublishId}
                              </span>
                            </div>

                            {/* Direct URL Input Display */}
                            <div className="flex items-center gap-1.5 bg-[#12141D] border border-white/10 rounded-lg px-2.5 py-1.5">
                              <input
                                type="text"
                                readOnly
                                value={fullDirectUrl}
                                className="flex-1 bg-transparent text-[11px] font-mono text-white/85 focus:outline-none truncate"
                              />
                              <button
                                type="button"
                                onClick={() => handleCopyDirectLink(plog)}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px] text-white shrink-0 cursor-pointer"
                              >
                                {copiedLogId === plog.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#00F0FF]" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Action Buttons: Open Direct Watch View & Platform Post Link */}
                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => onOpenDirectView(plog.jobId, plog)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#090A0F] hover:bg-[#00D6E4] transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Open Direct Video View</span>
                              </button>

                              {plog.platformPostUrl && (
                                <a
                                  href={plog.platformPostUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors shrink-0"
                                >
                                  <span>{plog.platform} Link</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
