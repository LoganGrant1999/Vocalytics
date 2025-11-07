/**
 * Validates if a string is a plausible YouTube video ID.
 * YouTube video IDs are typically 11 characters long and contain
 * alphanumeric characters, hyphens, and underscores.
 */
export function isValidYouTubeId(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // YouTube video IDs are 11 characters
  if (text.length !== 11) {
    return false;
  }

  // Valid characters: A-Z, a-z, 0-9, -, _
  const validPattern = /^[A-Za-z0-9_-]{11}$/;
  return validPattern.test(text);
}

/**
 * Extracts a YouTube video ID from a URL or returns the ID if already valid.
 *
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - VIDEO_ID (direct ID)
 */
export function extractYouTubeId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // If it's already a valid ID, return it
  if (isValidYouTubeId(trimmed)) {
    return trimmed;
  }

  try {
    // Try to parse as URL
    const url = new URL(trimmed);

    // youtube.com/watch?v=VIDEO_ID
    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v');
      if (videoId && isValidYouTubeId(videoId)) {
        return videoId;
      }
    }

    // youtu.be/VIDEO_ID
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1); // Remove leading /
      if (isValidYouTubeId(videoId)) {
        return videoId;
      }
    }
  } catch {
    // Not a valid URL, continue
  }

  return null;
}
