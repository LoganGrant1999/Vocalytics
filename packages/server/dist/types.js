// Minimal HTML → text normalizer for YouTube textDisplay / textOriginal
export function htmlToText(s) {
    if (!s)
        return "";
    const noTags = s.replace(/<[^>]+>/g, "");
    return noTags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
