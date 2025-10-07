export interface Comment {
  id: string;
  videoId: string;
  channelId: string;
  authorDisplayName: string;
  authorChannelId: string;
  textDisplay: string;
  textOriginal: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
}

export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
}

export interface Analysis {
  commentId: string;
  sentiment: SentimentScore;
  topics: string[];
  intent: string;
  toxicity: number;
}

export interface SentimentSummary {
  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  averageScores: SentimentScore;
  totalComments: number;
  topTopics: Array<{ topic: string; count: number }>;
  toxicityLevel: 'low' | 'moderate' | 'high';
}

export type Tone = 'friendly' | 'concise' | 'enthusiastic';

export interface GeneratedReply {
  tone: Tone;
  reply: string;
}
