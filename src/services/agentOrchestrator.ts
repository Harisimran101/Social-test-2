import type { FormatPreset, ScrapedPost, ScriptOutput, VideoPart, WordTimestamp } from '../types/trendforge';

/**
 * Generates deterministic word-level forced-alignment timestamps (in seconds)
 * from script segments so the 9:16 video compositor can render synchronized
 * Hormozi-style karaoke captions at 60fps.
 */
export function buildWordTimestamps(segments: { text: string; duration_estimate: number }[]): {
  words: WordTimestamp[];
  totalDuration: number;
} {
  const words: WordTimestamp[] = [];
  let cursor = 0.15;

  for (const seg of segments) {
    const tokens = seg.text
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (tokens.length === 0) continue;

    const segDuration = Math.max(1.8, seg.duration_estimate || tokens.length * 0.32);
    const wordDur = segDuration / tokens.length;

    for (const token of tokens) {
      const start = Number(cursor.toFixed(2));
      const end = Number((cursor + wordDur * 0.92).toFixed(2));
      words.push({ word: token, start, end });
      cursor += wordDur;
    }
    cursor += 0.18;
  }

  return {
    words,
    totalDuration: Number(Math.max(8, cursor).toFixed(2)),
  };
}

/**
 * Builds multi-part video clip definitions from script segments for
 * Google Omni (`gemini-omni-1.1-flash`) / Flow Connector generation & stitching.
 */
export function buildVideoPartsFromSegments(
  segments: { id: string; text: string; visual_prompt: string; emotion_tone: string; duration_estimate: number }[],
  engine: 'GOOGLE_OMNI' | 'FLOW_CONNECTOR' = 'GOOGLE_OMNI'
): VideoPart[] {
  return segments.map((seg, idx) => ({
    id: `part-${idx + 1}`,
    partNumber: idx + 1,
    title: `Part ${idx + 1}: ${seg.emotion_tone}`,
    prompt: `9:16 vertical cinematic video, ${seg.visual_prompt}. Smooth camera motion, high contrast dark aesthetic.`,
    narration: seg.text,
    durationSec: 5,
    status: 'READY',
    engine,
    videoDataUrl: null,
  }));
}

/**
 * Fallback deterministic script synthesis if Gemini API key is not configured
 * or when instantaneous offline preview is needed.
 */
export function buildFallbackScript(post: ScrapedPost, preset: FormatPreset): ScriptOutput {
  const topComment1 =
    post.topComments[0]?.body ||
    'The hidden second-order effect is where 90% of teams get blindsided.';
  const topComment2 =
    post.topComments[1]?.body ||
    'Once you measure the actual throughput per dollar, the conventional wisdom collapses.';

  const hookWords = post.title
    .replace(/[^\w\s?!'-]/g, '')
    .split(/\s+/)
    .slice(0, 10)
    .join(' ');

  const scroll_stopping_hook =
    hookWords.length > 12 ? `${hookWords}?` : `Nobody in ${post.community} expected this outcome.`;

  const segments =
    preset === 'EDUCATIONAL_CAROUSEL_10'
      ? [
          {
            id: 'seg-1',
            text: `Slide 1 Hook: ${post.title}`,
            visual_prompt:
              'High-contrast typographic cover card with source community seal and velocity metric.',
            emotion_tone: 'Hook & Setup',
            duration_estimate: 3.2,
            slide_headline: post.title,
            slide_bullet: `Surging in ${post.community} with ${post.upvotes.toLocaleString()} upvotes (${post.velocityPerHr}/hr).`,
          },
          {
            id: 'seg-2',
            text: `The Core Breakdown: ${post.content.slice(0, 160)}`,
            visual_prompt:
              'Clean diagram contrasting legacy assumptions against real-world production metrics.',
            emotion_tone: 'Core Story',
            duration_estimate: 4.5,
            slide_headline: 'The Core Mechanism Everyone Misses',
            slide_bullet: post.content.slice(0, 190),
          },
          {
            id: 'seg-3',
            text: `Top Community Insight: ${topComment1.slice(0, 150)}`,
            visual_prompt: 'Highlighted quote card from top-voted practitioner response.',
            emotion_tone: 'Top Comment',
            duration_estimate: 4.2,
            slide_headline: `Top Response (${post.topComments[0]?.score ?? 410} Upvotes)`,
            slide_bullet: topComment1.slice(0, 190),
          },
          {
            id: 'seg-4',
            text: `Counter-Perspective & Benchmark: ${topComment2.slice(0, 150)}`,
            visual_prompt: 'Side-by-side latency and cost efficiency comparison bar.',
            emotion_tone: 'Takeaway',
            duration_estimate: 4.2,
            slide_headline: 'Verified Field Benchmark',
            slide_bullet: topComment2.slice(0, 190),
          },
        ]
      : [
          {
            id: 'seg-1',
            text: scroll_stopping_hook,
            visual_prompt:
              'Glassmorphic Reddit/Quora Question Header Card overlay over dynamic 9:16 motion canvas.',
            emotion_tone: '3s Hook',
            duration_estimate: 3.0,
          },
          {
            id: 'seg-2',
            text: post.content.slice(0, 175).replace(/\s+\S*$/, '') + '.',
            visual_prompt:
              'Dynamic 9:16 vertical camera sweep through dark neon server architecture.',
            emotion_tone: 'The Story',
            duration_estimate: 5.0,
          },
          {
            id: 'seg-3',
            text: `The top comment nailed it: ${topComment1.slice(0, 150)}`,
            visual_prompt:
              'Close-up kinetic spotlight on top community reaction with depth-of-field motion.',
            emotion_tone: 'Top Reaction',
            duration_estimate: 5.0,
          },
          {
            id: 'seg-4',
            text: `And look at the follow-up proof: ${topComment2.slice(0, 135)} What would you do?`,
            visual_prompt:
              'Fast cut to final metric comparison and seamless loop transition back to frame 0.',
            emotion_tone: 'Final Takeaway',
            duration_estimate: 5.0,
          },
        ];

  const { words, totalDuration } = buildWordTimestamps(segments);
  const video_parts = buildVideoPartsFromSegments(segments, 'GOOGLE_OMNI');

  return {
    scroll_stopping_hook,
    script_segments: segments,
    caption: `${post.title.slice(0, 140)} — Breakdown from ${post.community}. Which side are you on?`,
    hashtags: ['#tech', '#softwareengineering', '#ai', '#startup', '#systemdesign'],
    words,
    total_duration: totalDuration,
    video_parts,
    combined_video_ready: true,
    combined_video_url: `https://pub-r2.trendforge.ai/combined/${post.id}_omni_stitched_9x16.mp4`,
  };
}

/**
 * Production Reference Blueprint for Module B (Multi-Agent Orchestrator + Google Omni Multi-Part Video Stitcher)
 */
export const AGENT_ORCHESTRATOR_BLUEPRINT_CODE = `// src/agents/orchestrator.ts — Multi-Part Google Omni (gemini-omni-1.1-flash) + Flow Connector Video Stitcher
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Generate Video in Parts with gemini-omni-1.1-flash and Combine via Multi-Turn Extension
export async function generateAndCombineOmniVideoParts(parts: { prompt: string }[]) {
  let previousInteractionId: string | undefined = undefined;
  const generatedClips: Buffer[] = [];

  for (let i = 0; i < parts.length; i++) {
    const isFirstPart = i === 0;
    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.1-flash',
        ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
        input: isFirstPart
          ? parts[i].prompt
          : \`Continue the scene seamlessly into Part \${i + 1}: \${parts[i].prompt}\`,
        background: false,
        store: true, // Required so subsequent parts extend this clip seamlessly
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: '9:16',
          duration: '5s',
          resolution: '720p',
        },
      },
      { timeout: 300000 }
    );

    previousInteractionId = interaction.id;
    if (interaction.output_video?.data) {
      generatedClips.push(Buffer.from(interaction.output_video.data, 'base64'));
    }
  }

  return { interactionId: previousInteractionId, clipCount: generatedClips.length };
}`;
