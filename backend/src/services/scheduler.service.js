import cron from 'node-cron';
import { prisma } from '../db.js';
import { generatePost, generateSubtopic } from './aiText.service.js';
import { generateImage } from './aiImage.service.js';
import { publishToFacebook } from './facebookPublish.service.js';

const SERVER_BASE_URL = `http://localhost:${process.env.PORT || 4000}`;

function nowHHMM(date = new Date()) {
  return date.toISOString().slice(11, 16); // "HH:MM" in UTC — see README re: timezones
}

function todayDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * One tick of the scheduler: find every active Automation whose user is
 * ACTIVE, check whether any of its posting times match the current minute,
 * and if so generate + publish a post to each connected Page — once per
 * (automation, page, time-slot, day) so we never double-post on retries.
 */
async function tick() {
  const currentHHMM = nowHHMM();
  const today = todayDateOnly();

  const automations = await prisma.automation.findMany({
    where: { isActive: true },
    include: { user: { include: { plan: true } } },
  });

  for (const automation of automations) {
    if (automation.user.status !== 'ACTIVE') continue;

    const postingTimes = JSON.parse(automation.postingTimes || '[]');
    if (!postingTimes.includes(currentHHMM)) continue;

    const activePageIds = JSON.parse(automation.activePageIds || '[]');
    if (activePageIds.length === 0) continue;

    // Respect plan + global daily caps.
    const plan = automation.user.plan;
    const maxPerDay = plan?.maxPostsPerDay ?? 1;
    const globalSettings = await prisma.adminSettings.findUnique({ where: { id: 1 } });
    const globalCap = globalSettings?.maxDailyPostsGlobal ?? 3;
    const effectiveCap = Math.min(maxPerDay, globalCap, 3); // hard spec ceiling of 3/day

    const slotIndex = postingTimes.indexOf(currentHHMM);
    if (slotIndex >= effectiveCap) continue; // plan doesn't allow this many slots

    for (const pageDbId of activePageIds) {
      const page = await prisma.facebookPage.findUnique({ where: { id: pageDbId } });
      if (!page) continue;

      const scheduledFor = new Date(`${today}T${currentHHMM}:00.000Z`);

      // Idempotency guard: skip if we already created a post for this exact slot today.
      const already = await prisma.post.findFirst({
        where: { userId: automation.userId, facebookPageId: page.id, scheduledFor },
      });
      if (already) continue;

      await processOnePost({ automation, page, scheduledFor, globalSettings });
    }
  }
}

async function processOnePost({ automation, page, scheduledFor, globalSettings }) {
  const usedSubtopics = JSON.parse(automation.subtopicHistory || '[]');

  let post;
  try {
    const subtopic = await generateSubtopic({
      topic: automation.topic,
      language: automation.language,
      usedSubtopics,
    });

    const hashtagCount = globalSettings?.hashtagCount ?? 6;
    const { postText, hashtags } = await generatePost({
      topic: automation.topic,
      language: automation.language,
      tone: automation.tone,
      subtopic,
      hashtagCount,
    });

    const imageUrl = await generateImage({ subtopic, tone: automation.tone, topic: automation.topic });

    post = await prisma.post.create({
      data: {
        userId: automation.userId,
        facebookPageId: page.id,
        subtopic,
        content: postText,
        hashtags: JSON.stringify(hashtags),
        imageUrl,
        scheduledFor,
        status: 'PENDING',
      },
    });

    const fullMessage = `${postText}\n\n${hashtags.join(' ')}`;
    const fbPostId = await publishToFacebook({
      page,
      message: fullMessage,
      imageUrl,
      serverBaseUrl: SERVER_BASE_URL,
    });

    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'PUBLISHED', fbPostId, publishedAt: new Date() },
    });

    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        lastSubtopicIndex: automation.lastSubtopicIndex + 1,
        subtopicHistory: JSON.stringify([...usedSubtopics, subtopic]),
      },
    });

    await prisma.activityLog.create({
      data: { userId: automation.userId, action: 'POST_PUBLISHED', detail: `${subtopic} -> Page ${page.pageName}` },
    });
  } catch (err) {
    console.error('[scheduler] Failed to publish post:', err.message);
    if (post) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'FAILED', errorMessage: err.message },
      });
    }
    await prisma.activityLog.create({
      data: { userId: automation.userId, action: 'POST_FAILED', detail: err.message },
    });
  }
}

/**
 * Separately, retry any FAILED posts if the admin has enabled retries.
 * Runs every 30 minutes.
 */
async function retryFailedTick() {
  const settings = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  if (!settings?.retryFailedPosts) return;

  const failed = await prisma.post.findMany({
    where: { status: 'FAILED' },
    include: { facebookPage: true },
    take: 20,
  });

  for (const post of failed) {
    try {
      const fullMessage = `${post.content}\n\n${JSON.parse(post.hashtags).join(' ')}`;
      const fbPostId = await publishToFacebook({
        page: post.facebookPage,
        message: fullMessage,
        imageUrl: post.imageUrl,
        serverBaseUrl: SERVER_BASE_URL,
      });
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', fbPostId, publishedAt: new Date(), errorMessage: null },
      });
    } catch (err) {
      await prisma.post.update({ where: { id: post.id }, data: { errorMessage: err.message } });
    }
  }
}

export function startScheduler() {
  // Every minute: check for due posts.
  cron.schedule('* * * * *', () => {
    tick().catch((err) => console.error('[scheduler] tick error:', err));
  });

  // Every 30 minutes: retry failures.
  cron.schedule('*/30 * * * *', () => {
    retryFailedTick().catch((err) => console.error('[scheduler] retry error:', err));
  });

  console.log('✅ Scheduler started (checks every minute, retries every 30 min)');
}
