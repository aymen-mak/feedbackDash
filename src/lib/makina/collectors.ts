// Authenticated, owner-only analytics collectors for our OWN accounts.
// These read the same numbers you'd see logged in, on a schedule. They need
// credentials supplied as environment secrets (never committed); without them
// each collector degrades gracefully and reports what's missing.

export interface CollectResult {
  values: Record<string, number | null>;
  error: string | null;
}

// Minimal structural view of the GramJS client (loaded at runtime).
type TgClient = {
  connect: () => Promise<unknown>;
  disconnect: () => Promise<unknown>;
  getEntity: (e: string) => Promise<unknown>;
  invoke: (q: unknown) => Promise<unknown>;
  iterMessages: (e: unknown, o: object) => AsyncIterable<{ date: number; views?: number }>;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Public web bearer used by x.com's own front-end (not a secret).
const X_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

// GraphQL operation ids drift over time; allow overriding from env without a redeploy of code.
const QID_USER = process.env.X_QID_USERBYNAME || "sLVLhk0bGj3MVFEKTdax1w";
const QID_TWEETS = process.env.X_QID_USERTWEETS || "V7H0Ap3_Hh2FyS75OCDO3Q";

const WEEK_MS = 7 * 24 * 3600 * 1000;

function envKey(accountKey: string): string {
  return accountKey.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

/** Per-account X cookies, falling back to the generic pair. */
function xCookies(accountKey: string): { authToken: string; ct0: string } | null {
  const k = envKey(accountKey);
  const authToken = process.env[`X_${k}_AUTH_TOKEN`] || process.env.X_AUTH_TOKEN;
  const ct0 = process.env[`X_${k}_CT0`] || process.env.X_CT0;
  return authToken && ct0 ? { authToken, ct0 } : null;
}

function xHeaders(ck: { authToken: string; ct0: string }): Record<string, string> {
  return {
    authorization: `Bearer ${X_BEARER}`,
    "x-csrf-token": ck.ct0,
    cookie: `auth_token=${ck.authToken}; ct0=${ck.ct0}`,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
    "content-type": "application/json",
    "User-Agent": UA,
  };
}

async function xGet(
  queryId: string,
  op: string,
  variables: object,
  features: object,
  headers: Record<string, string>
): Promise<unknown> {
  const url =
    `https://x.com/i/api/graphql/${queryId}/${op}` +
    `?variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&features=${encodeURIComponent(JSON.stringify(features))}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const USER_FEATURES = {
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  subscriptions_feature_can_gift_premium: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

const TWEET_FEATURES = {
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_analytics_enabled: false,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  view_counts_everywhere_api_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  rweb_video_timestamps_enabled: true,
};

interface TweetAgg {
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  shares: number;
}

/** Walk the timeline JSON defensively and sum public metrics for tweets in the window. */
function aggregateTweets(json: unknown, sinceMs: number): TweetAgg {
  const agg: TweetAgg = { impressions: 0, likes: 0, replies: 0, reposts: 0, bookmarks: 0, shares: 0 };
  const instructions =
    // userByScreenName timeline shape: data.user.result.timeline_v2.timeline.instructions
    (json as { data?: { user?: { result?: { timeline_v2?: { timeline?: { instructions?: unknown[] } } } } } })?.data
      ?.user?.result?.timeline_v2?.timeline?.instructions ?? [];
  for (const ins of instructions as Array<{ entries?: unknown[]; type?: string }>) {
    for (const entry of ins.entries ?? []) {
      const content = (entry as { content?: { itemContent?: { tweet_results?: { result?: unknown } } } }).content;
      const result = content?.itemContent?.tweet_results?.result as
        | { legacy?: Record<string, number | string>; views?: { count?: string }; tweet?: { legacy?: Record<string, number | string>; views?: { count?: string } } }
        | undefined;
      const node = result?.legacy ? result : result?.tweet?.legacy ? result.tweet : undefined;
      if (!node?.legacy) continue;
      const lg = node.legacy;
      if (lg.retweeted_status_result) continue; // skip pure retweets
      const created = typeof lg.created_at === "string" ? Date.parse(lg.created_at) : NaN;
      if (!Number.isNaN(created) && created < sinceMs) continue;
      agg.impressions += parseInt(String(node.views?.count ?? "0"), 10) || 0;
      agg.likes += Number(lg.favorite_count) || 0;
      agg.replies += Number(lg.reply_count) || 0;
      agg.reposts += Number(lg.retweet_count) || 0;
      agg.bookmarks += Number(lg.bookmark_count) || 0;
      agg.shares += Number(lg.quote_count) || 0;
    }
  }
  return agg;
}

/** X account analytics over the trailing 7 days, via stored session cookies. */
export async function collectXAnalytics(handle: string, accountKey: string): Promise<CollectResult> {
  const h = handle.replace(/^@/, "");
  const ck = xCookies(accountKey);
  if (!ck) {
    return { values: {}, error: `X cookies not set (X_${envKey(accountKey)}_AUTH_TOKEN / _CT0, or X_AUTH_TOKEN / X_CT0)` };
  }
  const headers = xHeaders(ck);
  const values: Record<string, number | null> = {};
  try {
    const userJson = (await xGet(
      QID_USER,
      "UserByScreenName",
      { screen_name: h },
      USER_FEATURES,
      headers
    )) as { data?: { user?: { result?: { rest_id?: string; legacy?: { followers_count?: number } } } } };
    const result = userJson?.data?.user?.result;
    const restId = result?.rest_id;
    if (result?.legacy?.followers_count != null) values.followers = result.legacy.followers_count;
    if (!restId) {
      return { values, error: "X: could not resolve account (cookies expired or query id stale?)" };
    }

    const tweetsJson = await xGet(
      QID_TWEETS,
      "UserTweets",
      { userId: restId, count: 100, includePromotedContent: false, withVoice: true },
      TWEET_FEATURES,
      headers
    );
    const agg = aggregateTweets(tweetsJson, Date.now() - WEEK_MS);
    values.impressions = agg.impressions;
    values.likes = agg.likes;
    values.replies = agg.replies;
    values.reposts = agg.reposts;
    values.bookmarks = agg.bookmarks;
    values.shares = agg.shares;
    const engagements = agg.likes + agg.replies + agg.reposts + agg.bookmarks + agg.shares;
    values.engagementRate = agg.impressions > 0 ? +((engagements / agg.impressions) * 100).toFixed(2) : null;
    // profileVisits lives only in the native analytics export — left for backfill.
    return { values, error: null };
  } catch (e) {
    return { values, error: `X: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Telegram channel statistics over the trailing 7 days, via an MTProto session. */
export async function collectTelegramStats(channel: string): Promise<CollectResult> {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const sessionStr = process.env.TELEGRAM_SESSION || "";
  const chan = (process.env.TELEGRAM_CHANNEL || channel).replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");
  if (!apiId || !apiHash || !sessionStr) {
    return { values: {}, error: "Telegram not set (TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION)" };
  }
  const values: Record<string, number | null> = {};
  let client: TgClient | null = null;
  try {
    const tg = await import("telegram");
    const { TelegramClient, Api } = tg;
    const { StringSession } = tg.sessions;
    client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
      connectionRetries: 2,
    }) as unknown as TgClient;
    await client!.connect();
    const entity = await client!.getEntity(chan);
    const full = (await client!.invoke(new Api.channels.GetFullChannel({ channel: entity as never }))) as {
      fullChat?: { participantsCount?: number };
    };
    if (full?.fullChat?.participantsCount != null) values.members = full.fullChat.participantsCount;

    const since = Math.floor((Date.now() - WEEK_MS) / 1000);
    let messages = 0;
    let views = 0;
    for await (const m of client!.iterMessages(entity, { limit: 1000 })) {
      if (m.date < since) break;
      messages += 1;
      views += m.views || 0;
    }
    values.messages = messages;
    if (views > 0) values.views = views;
    return { values, error: null };
  } catch (e) {
    return { values, error: `Telegram: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    try {
      await client?.disconnect();
    } catch {
      /* ignore */
    }
  }
}
