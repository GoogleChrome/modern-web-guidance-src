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
  console.log('Fetching all PRs and their file lists...');
  const listOutput = runGh(`pr list --state all --limit 1000 --json number,title,files`);
  const prs = JSON.parse(listOutput);
  console.log(`Found ${prs.length} PRs. Filtering for those affecting guides/...`);

  const results: any[] = [];

  for (const pr of prs) {
    const affectsGuides = pr.files.some((f: any) => f.path.startsWith('guides/'));
    
    if (!affectsGuides) {
      continue;
    }
    
    console.log(`Processing PR #${pr.number}: ${pr.title}`);
    
    try {
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
      }
      
    } catch (e) {
      console.error(`  Error processing PR #${pr.number}:`, e);
    }
  }


  const outputPath = path.join(process.cwd(), '.agents/skills/guide-reviewer/resources/reviews_data.json');

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Saved JSON data to ${outputPath}`);

  const mdContent = convertToMarkdown(results);
  const mdPath = outputPath.replace('.json', '.md');
  fs.writeFileSync(mdPath, mdContent);
  console.log(`Saved Markdown data to ${mdPath}`);
}

function convertToMarkdown(results: any[]): string {
  let md = '# PR Reviews Archive\n\n';
  
  for (const pr of results) {
    md += `## PR #${pr.number}: ${pr.title}\n\n`;
    
    if (pr.reviews.length > 0) {
      md += `### Reviews\n\n`;
      for (const review of pr.reviews) {
        md += `#### **${review.user}** (${review.state})\n`;
        if (review.body) {
          md += `> ${review.body.replace(/\n/g, '\n> ')}\n\n`;
        } else {
          md += `*(No review body)*\n\n`;
        }
      }
    }
    
    if (pr.comments.length > 0) {
      md += `### Comments\n\n`;
      for (const comment of pr.comments) {
        md += `#### **${comment.user}** on \`${comment.path}\`\n`;
        md += `> ${comment.body.replace(/\n/g, '\n> ')}\n\n`;
        
        if (comment.diff_hunk) {
          md += `<details>\n<summary>Diff Hunk</summary>\n\n\`\`\`diff\n${comment.diff_hunk}\n\`\`\`\n\n</details>\n\n`;
        }
      }
    }
    
    md += '---\n\n';
  }
  
  return md;
}

main();

