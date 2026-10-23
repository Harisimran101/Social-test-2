import type { ContentJob, PublishLog, PublishMode, SocialPlatform } from '../types/trendforge';

/**
 * Executes or simulates the 2026 Automated Social Publishing workflow:
 * 1. TikTok Content Posting API (`/v2/post/publish/video/init/` or `/v2/post/publish/content/init/`)
 *    with OAuth2 24h token refresh check, `DIRECT_POST` vs `MEDIA_UPLOAD` (Inbox Draft),
 *    and mandatory `is_aigc: true` disclosure flag.
 * 2. Instagram Graph API (`v21.0+` 2-step Container Workflow):
 *    Step 1: `POST /{ig-user-id}/media` (`media_type: "REELS"` or `CAROUSEL` with JPEG children)
 *    Step 2: Poll `GET /{ig-container-id}?fields=status_code` until `status_code === "FINISHED"`
 *    Step 3: `POST /{ig-user-id}/media_publish` with `creation_id`.
 */
export function createPublishExecutionTrace(params: {
  job: ContentJob;
  platform: SocialPlatform;
  publishMode: PublishMode;
  privacyLevel?: string;
  disableDuet?: boolean;
  disableStitch?: boolean;
  isAigc?: boolean;
}): PublishLog {
  const {
    job,
    platform,
    publishMode,
    privacyLevel = 'PUBLIC_TO_EVERYONE',
    isAigc = true,
  } = params;

  const now = Date.now();
  const idSuffix = Math.random().toString(36).substring(2, 9).toUpperCase();

  if (platform === 'TIKTOK') {
    const endpoint =
      job.format === 'IMAGE_CAROUSEL'
        ? 'POST https://open.tiktokapis.com/v2/post/publish/content/init/'
        : publishMode === 'DIRECT'
        ? 'POST https://open.tiktokapis.com/v2/post/publish/video/init/'
        : 'POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

    return {
      id: `pub-tt-${idSuffix}`,
      jobId: job.id,
      platform: 'TIKTOK',
      publishMode,
      externalPublishId: `742891049281_${idSuffix}`,
      directViewUrl: `/?watch=${encodeURIComponent(job.id)}&platform=TIKTOK&pubId=742891049281_${idSuffix}`,
      platformPostUrl: `https://www.tiktok.com/@trendforge.ai/video/742891049281_${idSuffix}`,
      status: 'PUBLISHED',
      privacyLevel,
      isAigc,
      containerSteps: [
        {
          step: '01. OAuth2 Token Validation',
          endpoint: 'POST https://open.tiktokapis.com/v2/oauth/token/ (scopes: video.publish, video.upload)',
          status: 'TOKEN_VALID (23h 41m remaining)',
          timestamp: new Date(now - 2400).toISOString(),
        },
        {
          step:
            job.format === 'IMAGE_CAROUSEL'
              ? '02. Photo Carousel Init (Verified R2 JPEG Domain)'
              : `02. Initialize ${publishMode === 'DIRECT' ? 'DIRECT_POST' : 'MEDIA_UPLOAD (Inbox Draft)'}`,
          endpoint,
          status: `200 OK · is_aigc=${String(isAigc)} · privacy=${privacyLevel}`,
          timestamp: new Date(now - 1200).toISOString(),
        },
        {
          step: '03. Status Confirmation Poll',
          endpoint: 'POST https://open.tiktokapis.com/v2/post/publish/status/fetch/',
          status: publishMode === 'DIRECT' ? 'PUBLISH_COMPLETE' : 'SEND_TO_USER_INBOX',
          timestamp: new Date(now).toISOString(),
        },
      ],
      createdAt: new Date(now).toISOString(),
    };
  }

  // INSTAGRAM GRAPH API v21.0+ Container Workflow
  const containerId = `17895695668_${idSuffix}`;
  const creationId = `17920481920_${idSuffix}`;

  return {
    id: `pub-ig-${idSuffix}`,
    jobId: job.id,
    platform: 'INSTAGRAM',
    publishMode,
    externalPublishId: creationId,
    directViewUrl: `/?watch=${encodeURIComponent(job.id)}&platform=INSTAGRAM&pubId=${creationId}`,
    platformPostUrl: `https://www.instagram.com/reel/${creationId}/`,
    status: 'PUBLISHED',
    isAigc,
    containerSteps:
      job.format === 'IMAGE_CAROUSEL'
        ? [
            {
              step: '01. Child JPEG Containers',
              endpoint: 'POST https://graph.facebook.com/v21.0/{ig-user-id}/media (is_carousel_item=true, .jpg)',
              status: `${job.scriptJson?.script_segments.length || 4} child containers created`,
              timestamp: new Date(now - 3800).toISOString(),
            },
            {
              step: '02. Parent CAROUSEL Container',
              endpoint: `POST https://graph.facebook.com/v21.0/{ig-user-id}/media (media_type=CAROUSEL) -> ${containerId}`,
              status: 'CONTAINER_CREATED',
              timestamp: new Date(now - 2200).toISOString(),
            },
            {
              step: '03. Container Status Polling (5s interval)',
              endpoint: `GET https://graph.facebook.com/v21.0/${containerId}?fields=status_code`,
              status: 'status_code === "FINISHED"',
              timestamp: new Date(now - 600).toISOString(),
            },
            {
              step: '04. Media Publish Execution',
              endpoint: `POST https://graph.facebook.com/v21.0/{ig-user-id}/media_publish (creation_id=${containerId})`,
              status: `PUBLISHED (id: ${creationId})`,
              timestamp: new Date(now).toISOString(),
            },
          ]
        : [
            {
              step: '01. REELS Media Container Init',
              endpoint: `POST https://graph.facebook.com/v21.0/{ig-user-id}/media (media_type=REELS, share_to_feed=true)`,
              status: `Container ID: ${containerId}`,
              timestamp: new Date(now - 3200).toISOString(),
            },
            {
              step: '02. Container Status Polling Worker',
              endpoint: `GET https://graph.facebook.com/v21.0/${containerId}?fields=status_code`,
              status: 'Poll #1: IN_PROGRESS -> Poll #2: FINISHED',
              timestamp: new Date(now - 800).toISOString(),
            },
            {
              step: '03. Media Publish Commit',
              endpoint: `POST https://graph.facebook.com/v21.0/{ig-user-id}/media_publish (creation_id=${containerId})`,
              status: `PUBLISHED (id: ${creationId})`,
              timestamp: new Date(now).toISOString(),
            },
          ],
    createdAt: new Date(now).toISOString(),
  };
}

/**
 * Production Reference Blueprint for Module C (TikTok v2 Content Posting API + Instagram Graph API v21.0+)
 */
export const PUBLISHING_SERVICE_BLUEPRINT_CODE = `// src/services/socialPublisher.ts — 2026 TikTok v2 & Instagram Graph API v21.0+ Publishing Engine
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Automatic 24-Hour TikTok OAuth2 Token Refresh
export async function ensureFreshTikTokToken(accountId: string): Promise<string> {
  const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } });
  const bufferMs = 15 * 60 * 1000; // Refresh 15 mins prior to expiration
  if (account.expiresAt.getTime() - Date.now() > bufferMs) {
    return account.accessToken;
  }

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    }),
  });
  const data = await res.json();
  const updated = await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return updated.accessToken;
}

// 2. TikTok Content Posting API (/v2/post/publish/) — Supports DIRECT_POST, MEDIA_UPLOAD & PHOTO Carousels
export async function publishToTikTok(params: {
  accountId: string;
  mode: 'DIRECT' | 'DRAFT';
  format: 'VIDEO_REEL' | 'IMAGE_CAROUSEL';
  mediaUrls: string[]; // Public Cloudflare R2 / S3 verified domain URLs
  caption: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
}) {
  const token = await ensureFreshTikTokToken(params.accountId);

  if (params.format === 'IMAGE_CAROUSEL') {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: {
          title: params.caption.slice(0, 90),
          description: params.caption,
          privacy_level: params.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
          auto_add_music: true,
          is_aigc: true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: params.mediaUrls, // Strictly verified domain .jpg URLs
        },
        post_mode: params.mode === 'DIRECT' ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
        media_type: 'PHOTO',
      }),
    });
    return await res.json();
  }

  // Video Reel (DIRECT_POST vs Inbox Draft MEDIA_UPLOAD)
  const endpoint =
    params.mode === 'DIRECT'
      ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
      : 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: params.caption,
        privacy_level: params.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
        is_aigc: true, // Mandatory 2026 AI-generated content disclosure flag
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: params.mediaUrls[0],
      },
    }),
  });
  return await res.json();
}

// 3. Instagram Graph API (v21.0+ Container Workflow with 5-Second Status Polling)
export async function publishToInstagram(params: {
  igUserId: string;
  accessToken: string;
  format: 'VIDEO_REEL' | 'IMAGE_CAROUSEL';
  mediaUrls: string[];
  caption: string;
}) {
  const baseUrl = \`https://graph.facebook.com/v21.0/\${params.igUserId}\`;
  let creationId = '';

  if (params.format === 'VIDEO_REEL') {
    // Step 1: Create REELS Container
    const containerRes = await fetch(\`\${baseUrl}/media\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: params.mediaUrls[0],
        caption: params.caption,
        share_to_feed: true,
        access_token: params.accessToken,
      }),
    });
    const containerData = await containerRes.json();
    creationId = containerData.id;
  } else {
    // Step 1a: Create Child JPEG Containers (is_carousel_item: true)
    const childIds: string[] = [];
    for (const jpegUrl of params.mediaUrls) {
      const childRes = await fetch(\`\${baseUrl}/media\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: jpegUrl, // Strictly JPEG
          is_carousel_item: true,
          access_token: params.accessToken,
        }),
      });
      const childData = await childRes.json();
      childIds.push(childData.id);
    }
    // Step 1b: Create Parent CAROUSEL Container
    const parentRes = await fetch(\`\${baseUrl}/media\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: params.caption,
        access_token: params.accessToken,
      }),
    });
    const parentData = await parentRes.json();
    creationId = parentData.id;
  }

  // Step 2: Poll GET /{ig-container-id}?fields=status_code every 5 seconds until FINISHED
  for (let attempt = 0; attempt < 24; attempt++) {
    const statusRes = await fetch(
      \`https://graph.facebook.com/v21.0/\${creationId}?fields=status_code&access_token=\${params.accessToken}\`
    );
    const { status_code } = await statusRes.json();
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR') throw new Error('Instagram container processing failed');
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Step 3: Publish Container
  const publishRes = await fetch(\`\${baseUrl}/media_publish\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: params.accessToken }),
  });
  return await publishRes.json();
}`;
