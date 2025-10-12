// Canonical internal comment shape for Vocalytics
export interface TWComment {
  id: string;
  videoId: string;
  author: string;          // normalized from authorDisplayName
  text: string;            // plain text (no HTML)
  publishedAt: string;     // ISO string
  likeCount: number;
  replyCount: number;
  isReply: boolean;
  parentId?: string;
}

// Minimal HTML → text normalizer for YouTube textDisplay / textOriginal
export function htmlToText(s: string): string {
  if (!s) return "";
  const noTags = s.replace(/<[^>]+>/g, "");
  return noTags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
