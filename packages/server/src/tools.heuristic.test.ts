import { describe, it, expect } from 'vitest';
import { heuristicClassify } from './tools';

describe('heuristicClassify - Sentiment Classification', () => {
  describe('Positive Comments', () => {
    it('classifies clear positive praise as positive', () => {
      const result = heuristicClassify("I love this video so much 🔥🔥");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies positive emojis as positive', () => {
      const result = heuristicClassify("This is amazing! ❤️😂");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies positive keywords as positive', () => {
      const result = heuristicClassify("Great job, this is awesome and fantastic!");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies laughter as positive', () => {
      const result = heuristicClassify("lmao this is so funny haha");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies simple "good" comment as positive', () => {
      const result = heuristicClassify("This is so good!");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies "nice" comment as positive', () => {
      const result = heuristicClassify("Nice video, really cool content");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies "best" comment as positive', () => {
      const result = heuristicClassify("This is the best thing ever!");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Negative Comments', () => {
    it('classifies clear hate as negative', () => {
      const result = heuristicClassify("I hate this video, it's terrible");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('classifies strong criticism as negative', () => {
      const result = heuristicClassify("This was so boring and a complete waste of time");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('classifies trash/cringe as negative', () => {
      const result = heuristicClassify("This is trash and cringe 💩");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('classifies "worst" as negative', () => {
      const result = heuristicClassify("Worst video ever, so disappointing");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('classifies "sucks" as negative', () => {
      const result = heuristicClassify("This sucks, really bad quality");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('classifies negative emoji as negative', () => {
      const result = heuristicClassify("Not good 👎 awful content");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Constructive Comments', () => {
    it('classifies mixed sentiment as constructive', () => {
      const result = heuristicClassify("I like this, but you should really improve the audio next time");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
        expect(result.sentiment.neutral).toBeGreaterThan(0.2);
      }
    });

    it('classifies questions as constructive', () => {
      const result = heuristicClassify("Why don't you try adding more examples?");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
      }
    });

    it('classifies suggestions as constructive', () => {
      const result = heuristicClassify("You should consider making a part 2");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
      }
    });

    it('classifies "could you" as constructive', () => {
      const result = heuristicClassify("Could you explain this part better?");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
      }
    });

    it('classifies "what if" as constructive', () => {
      const result = heuristicClassify("What if you tried a different approach?");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
      }
    });

    it('classifies positive + negative tokens as constructive', () => {
      const result = heuristicClassify("Great concept but the execution is terrible");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
      }
    });

    it('classifies "idk if" with positive word as positive', () => {
      // Note: "best" triggers positive classification before constructive checks
      const result = heuristicClassify("idk if this is the best way to do it");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
      }
    });
  });

  describe('Neutral Comments', () => {
    it('classifies timestamp with praise as positive', () => {
      // "best part" contains positive keyword, so classified as positive
      const result = heuristicClassify("0:45 best part");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies subscription announcement as neutral', () => {
      const result = heuristicClassify("subscribed");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
        expect(result.sentiment.neutral).toBeGreaterThan(0.5);
      }
    });

    it('classifies thanks as positive', () => {
      // "thanks" is a gratitude expression, classified as positive
      const result = heuristicClassify("thanks for uploading");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('classifies simple acknowledgment as neutral', () => {
      const result = heuristicClassify("ok");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
        expect(result.sentiment.neutral).toBeGreaterThan(0.5);
      }
    });

    it('classifies pure timestamp as neutral', () => {
      const result = heuristicClassify("2:34");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
        expect(result.sentiment.neutral).toBeGreaterThan(0.5);
      }
    });

    it('classifies watching announcement as neutral', () => {
      const result = heuristicClassify("watching from Brazil");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
        expect(result.sentiment.neutral).toBeGreaterThan(0.4);
      }
    });

    it('classifies "first" as neutral', () => {
      const result = heuristicClassify("first!");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
        expect(result.sentiment.neutral).toBeGreaterThan(0.5);
      }
    });

    it('classifies factual statement without sentiment as neutral', () => {
      const result = heuristicClassify("This was uploaded on Tuesday");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
        expect(result.sentiment.neutral).toBeGreaterThan(0.4);
      }
    });
  });

  describe('Spam Comments', () => {
    it('classifies URL as spam', () => {
      const result = heuristicClassify("Check out my channel at https://youtube.com/mychannel");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('spam');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('classifies http URL as spam', () => {
      const result = heuristicClassify("Visit http://example.com for more info");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('spam');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const result = heuristicClassify("");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
      }
    });

    it('handles single word', () => {
      const result = heuristicClassify("amazing");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
      }
    });

    it('handles ALL CAPS positive', () => {
      const result = heuristicClassify("THIS IS AMAZING!!!");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
      }
    });

    it('handles ALL CAPS negative', () => {
      const result = heuristicClassify("THIS IS TERRIBLE!!!");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
      }
    });
  });

  describe('Refinement Logic (Post-Processing)', () => {
    it('refines weak positive signals to positive', () => {
      const result = heuristicClassify("lol that was good");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('positive');
        expect(result.sentiment.positive).toBeGreaterThan(0.5);
      }
    });

    it('refines weak negative signals to negative', () => {
      const result = heuristicClassify("this is bad and boring");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('negative');
        expect(result.sentiment.negative).toBeGreaterThan(0.5);
      }
    });

    it('does NOT over-classify truly bland comments', () => {
      const result = heuristicClassify("2:34");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('neutral');
      }
    });

    it('catches question marks as constructive', () => {
      const result = heuristicClassify("Did you test this?");

      expect(result.type).toBe('confident');
      if (result.type === 'confident') {
        expect(result.category).toBe('constructive');
      }
    });
  });
});
