import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REVIEWERS = ['philipwalton', 'rviscomi', 'malchata'];
const REPO = 'GoogleChrome/guidance';

function runGh(args: string): string {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    console.error(`Failed to run: gh ${args}`);
    throw error;
  }
}

function main() {
  console.log('Searching for PRs...');
  // Search for PRs that might be relevant. We search for "guide" keyword as a heuristic.
  // We can't easily filter by path in search for PR files changed.
  const searchOutput = runGh(`search prs "guide" --repo ${REPO} --limit 100 --json number,title`);
  const prs = JSON.parse(searchOutput);
  console.log(`Found ${prs.length} candidate PRs.`);

  const results: any[] = [];

  for (const pr of prs) {
    console.log(`Checking PR #${pr.number}: ${pr.title}`);
    
    // Check files
    try {
      const filesOutput = runGh(`pr view ${pr.number} --json files`);
      const { files } = JSON.parse(filesOutput);
      
      const affectsGuides = files.some((f: any) => f.path.startsWith('guides/'));
      
      if (!affectsGuides) {
        console.log(`  Skipping (does not affect guides/)`);
        continue;
      }
      
      console.log(`  Affects guides/. Fetching reviews...`);
      
      // Fetch reviews
      const reviewsOutput = runGh(`api repos/${REPO}/pulls/${pr.number}/reviews`);
      const reviews = JSON.parse(reviewsOutput);
      
      // Fetch review comments (inline)
      const commentsOutput = runGh(`api repos/${REPO}/pulls/${pr.number}/comments`);
      const comments = JSON.parse(commentsOutput);
      
      const prData: any = {
        number: pr.number,
        title: pr.title,
        reviews: [],
        comments: []
      };
      
      // Filter reviews by our target reviewers
      for (const review of reviews) {
        if (REVIEWERS.includes(review.user.login)) {
          prData.reviews.push({
            user: review.user.login,
            state: review.state,
            body: review.body,
            submitted_at: review.submitted_at
          });
        }
      }
      
      // Filter comments by our target reviewers
      for (const comment of comments) {
        if (REVIEWERS.includes(comment.user.login)) {
          prData.comments.push({
            user: comment.user.login,
            body: comment.body,
            path: comment.path,
            diff_hunk: comment.diff_hunk,
            created_at: comment.created_at
          });
        }
      }
      
      if (prData.reviews.length > 0 || prData.comments.length > 0) {
        console.log(`  Found relevant reviews/comments!`);
        results.push(prData);
      } else {
        console.log(`  No reviews from target reviewers.`);
      }
      
    } catch (e) {
      console.error(`  Error processing PR #${pr.number}:`, e);
    }
  }

  const outputPath = path.join(process.cwd(), 'scripts', 'reviews_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Done! Saved data to ${outputPath}`);
}

main();
