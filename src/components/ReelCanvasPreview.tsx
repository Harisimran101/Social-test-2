import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  ChevronLeft,
  ChevronRight,
  Film,
} from 'lucide-react';
import type { FormatPreset, ScrapedPost, ScriptOutput } from '../types/trendforge';

interface ReelCanvasPreviewProps {
  post: ScrapedPost;
  preset: FormatPreset;
  script: ScriptOutput;
  audioBase64: string | null;
  onSynthesizeAudio: (voice: string) => void;
  isSynthesizingAudio: boolean;
}

export const ReelCanvasPreview: React.FC<ReelCanvasPreviewProps> = ({
  post,
  preset,
  script,
  audioBase64,
  onSynthesizeAudio,
  isSynthesizingAudio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isExportingCombinedVideo, setIsExportingCombinedVideo] = useState<boolean>(false);

  const isCarousel = preset === 'EDUCATIONAL_CAROUSEL_10';
  const totalDuration = Math.max(8, script.total_duration || 16);
  const numParts = script.script_segments.length || 4;

  // Determine which Part (1..N) is currently playing in the combined timeline
  let accumulated = 0;
  let activePartIndex = 0;
  for (let i = 0; i < script.script_segments.length; i++) {
    accumulated += script.script_segments[i].duration_estimate || 4;
    if (currentTime <= accumulated) {
      activePartIndex = i;
      break;
    }
  }
  const activeSegment =
    script.script_segments[activePartIndex] || script.script_segments[0];

  useEffect(() => {
    setCurrentTime(0);
    setActiveSlideIndex(0);
  }, [post.id, preset]);

  useEffect(() => {
    if (!audioBase64) return;
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    audio.muted = isMuted;
    audioRef.current = audio;
    if (isPlaying && !isCarousel) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioBase64]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // 60fps HTML5 Canvas Render Loop combining all parts into one continuous 9:16 stream
  useEffect(() => {
    if (isCarousel) return;

    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const renderFrame = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const next = prev + dt;
          if (next >= totalDuration) {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
            return 0;
          }
          return next;
        });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const t = performance.now() / 1000;

          ctx.clearRect(0, 0, w, h);

          // Distinct visual scene color shift per Part so combined parts feel dynamic
          const partHuePalettes = [
            ['#090D1A', '#161B33', 'rgba(0, 240, 255, 0.24)'],
            ['#0C091A', '#1E1436', 'rgba(138, 43, 226, 0.26)'],
            ['#081418', '#112A32', 'rgba(0, 240, 255, 0.28)'],
            ['#120B1D', '#241538', 'rgba(168, 85, 247, 0.28)'],
          ];
          const palette = partHuePalettes[activePartIndex % partHuePalettes.length];

          const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
          skyGrad.addColorStop(0, palette[0]);
          skyGrad.addColorStop(0.5, palette[1]);
          skyGrad.addColorStop(1, '#090A0F');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, w, h);

          if (preset === 'REDDIT_STORY_GAMEPLAY') {
            const speed = isPlaying ? t * 3.0 : currentTime * 3.0;
            const numBlocks = 9;
            for (let i = 0; i < numBlocks; i++) {
              const depth = ((i - (speed % 1) + numBlocks) % numBlocks) / numBlocks;
              if (depth < 0.08) continue;
              const perspective = Math.pow(depth, 1.85);
              const y = h * 0.42 + perspective * (h * 0.58);
              const laneOffset = Math.sin(i * 1.7 + Math.floor(speed)) * 0.28;
              const x = w * 0.5 + laneOffset * w * perspective;
              const bw = 46 + perspective * 140;
              const bh = 16 + perspective * 46;

              ctx.fillStyle = palette[2];
              ctx.strokeStyle =
                activePartIndex % 2 === 0
                  ? 'rgba(0, 240, 255, 0.65)'
                  : 'rgba(168, 85, 247, 0.65)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 6);
              ctx.fill();
              ctx.stroke();
            }
          } else {
            const phase = isPlaying ? t * 0.8 : currentTime * 0.8;
            for (let i = 0; i < 6; i++) {
              const xPos = ((i * 75 + phase * 42) % (w + 120)) - 60;
              const beamGrad = ctx.createLinearGradient(xPos, 0, xPos + 80, h);
              beamGrad.addColorStop(0, palette[2]);
              beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = beamGrad;
              ctx.fillRect(xPos, 0, 64, h);
            }
          }

          // Contrast scrim
          const scrimGrad = ctx.createLinearGradient(0, 0, 0, h);
          scrimGrad.addColorStop(0, 'rgba(9, 10, 15, 0.78)');
          scrimGrad.addColorStop(0.35, 'rgba(9, 10, 15, 0.22)');
          scrimGrad.addColorStop(0.68, 'rgba(9, 10, 15, 0.45)');
          scrimGrad.addColorStop(1, 'rgba(9, 10, 15, 0.92)');
          ctx.fillStyle = scrimGrad;
          ctx.fillRect(0, 0, w, h);
        }
      }

      animationFrameId = requestAnimationFrame(renderFrame);
    };

    animationFrameId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isCarousel, preset, totalDuration, currentTime, activePartIndex]);

  // Karaoke word window
  const words = script.words || [];
  let activeWordIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end + 0.08
  );
  if (activeWordIdx === -1) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (currentTime >= words[i].start) {
        activeWordIdx = i;
        break;
      }
    }
  }
  const safeWordIdx = Math.max(0, activeWordIdx);
  const windowStart = Math.floor(safeWordIdx / 5) * 5;
  const visibleWords = words.slice(windowStart, windowStart + 5);

  // Record & Export Combined Multi-Part Video from Canvas
  const handleExportCombinedVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas || isExportingCombinedVideo) return;

    try {
      setIsExportingCombinedVideo(true);
      setCurrentTime(0);
      setIsPlaying(true);

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trendforge_${post.id}_combined_${numParts}parts.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExportingCombinedVideo(false);
      };
      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 4000);
    } catch {
      setIsExportingCombinedVideo(false);
    }
  };

  // Export Carousel Slide as JPEG
  const handleDownloadSlideJpeg = () => {
    const slide = script.script_segments[activeSlideIndex] || script.script_segments[0];
    const offscreen = document.createElement('canvas');
    offscreen.width = 1080;
    offscreen.height = 1350;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
    grad.addColorStop(0, '#090A0F');
    grad.addColorStop(0.5, '#12141D');
    grad.addColorStop(1, '#090A0F');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(56, 56, 1080 - 112, 1350 - 112);

    ctx.fillStyle = '#00F0FF';
    ctx.font = '600 28px "JetBrains Mono", monospace';
    ctx.fillText(
      `${post.community}  ·  SLIDE 0${activeSlideIndex + 1} / 0${script.script_segments.length}`,
      110,
      150
    );

    ctx.fillStyle = '#F3F4F6';
    ctx.font = '700 56px "Plus Jakarta Sans", sans-serif';
    const headlineText = slide?.slide_headline || slide?.text || post.title;
    const headlineWords = headlineText.split(' ');
    let line = '';
    let y = 290;
    for (const word of headlineWords) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > 860) {
        ctx.fillText(line.trim(), 110, y);
        line = word + ' ';
        y += 74;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), 110, y);
      y += 96;
    }

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '400 36px "DM Sans", sans-serif';
    const bodyWords = (slide?.text || '').split(' ');
    line = '';
    for (const word of bodyWords) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > 860) {
        ctx.fillText(line.trim(), 110, y);
        line = word + ' ';
        y += 54;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), 110, y);
    }

    const jpegDataUrl = offscreen.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.href = jpegDataUrl;
    link.download = `trendforge_${post.id}_slide_0${activeSlideIndex + 1}.jpg`;
    link.click();
  };

  return (
    <div className="flex flex-col items-center">
      {/* 9:16 Vertical Canvas / 4:5 Carousel Frame */}
      <div
        className={`relative w-full max-w-[290px] ${
          isCarousel ? 'aspect-[4/5]' : 'aspect-[9/16]'
        } rounded-2xl overflow-hidden border border-white/15 bg-[#090A0F] shadow-2xl select-none`}
      >
        {!isCarousel ? (
          <>
            <canvas
              ref={canvasRef}
              width={360}
              height={640}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Top Part Indicator & Time */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono tabular-nums text-white/85 z-10">
              <span className="text-[#00F0FF] font-semibold">
                PART {activePartIndex + 1}/{numParts} · COMBINED
              </span>
              <span>
                {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
              </span>
            </div>

            {/* Multi-part segment progress bars at top (Story/Reel style) */}
            <div className="absolute top-8 left-3 right-3 grid grid-cols-4 gap-1 z-10">
              {script.script_segments.map((seg, idx) => (
                <div key={seg.id} className="h-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      idx < activePartIndex
                        ? 'w-full bg-[#00F0FF]'
                        : idx === activePartIndex
                        ? 'w-2/3 bg-[#00F0FF]'
                        : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* First 3 Seconds: Question Header Card */}
            {currentTime <= 3.2 && (
              <div className="absolute top-12 left-3.5 right-3.5 p-3.5 rounded-xl bg-[#12141D]/90 backdrop-blur-md border border-white/15 z-10">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#00F0FF] tabular-nums">
                  <span>{post.community}</span>
                  <span>{post.upvotes.toLocaleString()} upvotes</span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-white leading-snug line-clamp-3">
                  {script.scroll_stopping_hook}
                </p>
              </div>
            )}

            {/* Active Part Scene Direction */}
            <div className="absolute top-[46%] left-4 right-4 text-center z-10 pointer-events-none">
              <p className="text-[10px] font-mono text-white/60 line-clamp-2">
                {activeSegment?.visual_prompt}
              </p>
            </div>

            {/* Word-by-Word Synchronized Karaoke Captions */}
            <div className="absolute bottom-12 left-3.5 right-3.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center z-10 min-h-[60px]">
              {visibleWords.map((w, idx) => {
                const globalIdx = windowStart + idx;
                const isActive = globalIdx === safeWordIdx;
                return (
                  <span
                    key={`${w.word}-${globalIdx}`}
                    className={`font-display font-bold tracking-tight transition-transform duration-100 ${
                      isActive
                        ? 'text-[#00F0FF] scale-110 text-lg drop-shadow-[0_2px_10px_rgba(0,240,255,0.45)]'
                        : 'text-white text-base drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]'
                    }`}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <div className="relative w-full h-full p-5 flex flex-col justify-between bg-gradient-to-br from-[#090A0F] via-[#12141D] to-[#0D101B]">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#00F0FF] tabular-nums border-b border-white/10 pb-2.5">
              <span>{post.community}</span>
              <span>
                SLIDE 0{activeSlideIndex + 1} / 0{script.script_segments.length}
              </span>
            </div>

            <div className="my-auto py-3">
              <h4 className="font-display text-base font-bold text-white leading-snug mb-2.5">
                {script.script_segments[activeSlideIndex]?.slide_headline ||
                  script.script_segments[activeSlideIndex]?.text.slice(0, 60)}
              </h4>
              <p className="text-xs text-white/80 leading-relaxed">
                {script.script_segments[activeSlideIndex]?.text}
              </p>
            </div>

            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/50 tabular-nums">
              <span>1080x1350 · JPG</span>
              <span>SWIPE NEXT →</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls Below Preview */}
      {!isCarousel ? (
        <div className="mt-3 w-full max-w-[290px] space-y-2">
          <div className="flex items-center justify-between gap-2 bg-[#12141D] border border-white/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setCurrentTime(0)}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.1}
              value={currentTime}
              onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
              className="w-28 accent-[#00F0FF] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSynthesizeAudio(selectedVoice)}
              disabled={isSynthesizingAudio}
              className="py-2 px-2.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isSynthesizingAudio ? 'Synthesizing...' : 'Play AI Voiceover'}
            </button>

            <button
              type="button"
              onClick={handleExportCombinedVideo}
              disabled={isExportingCombinedVideo}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Film className="w-3.5 h-3.5" />
              <span>{isExportingCombinedVideo ? 'Combining...' : 'Download Video'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 w-full max-w-[290px] flex items-center justify-between gap-2 bg-[#12141D] border border-white/10 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setActiveSlideIndex((prev) =>
                  prev > 0 ? prev - 1 : script.script_segments.length - 1
                )
              }
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono tabular-nums px-2 text-white/80">
              {activeSlideIndex + 1} / {script.script_segments.length}
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveSlideIndex((prev) =>
                  prev < script.script_segments.length - 1 ? prev + 1 : 0
                )
              }
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSlideJpeg}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .JPG</span>
          </button>
        </div>
      )}
    </div>
  );
};
