
import { db, Comments } from 'astro:db';
import { getCollection } from 'astro:content';

const genericSentences = [
  "This is a really insightful take on the issue.",
  "I never thought about it that way before, thank you.",
  "Can you provide a source for that claim?",
  "I completely agree with the author.",
  "I have to disagree on this point, I think you're missing the bigger picture.",
  "This is some of the best analysis I've read on the topic.",
  "Fascinating stuff. I'm looking forward to the follow-up.",
  "I'm not sure I understand. Could you elaborate?",
  "This has major implications for the industry.",
  "Well written, but I think it oversimplifies a complex problem."
];

const authors = ["NewsFan", "CriticalThinker", "JaneDoe", "JohnSmith", "UrbanDweller", "Observer22"];

export default async function() {
  await db.delete(Comments);

  const articles = await getCollection('articles');
  const commentsToSeed = [];

  for (const article of articles) {
    const commentCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 comments per article
    for (let i = 0; i < commentCount; i++) {
      const author = authors[Math.floor(Math.random() * authors.length)];
      const sentenceCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 sentences
      let body = '';
      for (let j = 0; j < sentenceCount; j++) {
        body += genericSentences[Math.floor(Math.random() * genericSentences.length)] + ' ';
      }
      
      commentsToSeed.push({
        slug: article.slug,
        author,
        body: body.trim(),
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 1000 * 3600 * 24 * 5)) // Random time in last 5 days
      });
    }
  }

  await db.insert(Comments).values(commentsToSeed);
}
