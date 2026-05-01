import { runCommand, escapeLeftAngleBracket } from './lib/utils.ts';
import { lookupFeature, type PassRates } from './guide-gen.ts';

export interface UseCase {
  slug: string;
  description: string;
  category: string;
}

export function constructPRBody(featureId: string, useCases: UseCase[], passRates?: Record<string, PassRates>): string {
  const branch = `bot/${featureId}`;
  const repo = process.env.GITHUB_REPOSITORY || 'paulirish/guidance';
  const emoji  = [...'😀😁😂🤣😃😄😅😆😉😊😋😎😍🥰😘'].at(Math.floor(Math.random() * 15));
  const feature = lookupFeature(featureId);

  let body = `\`${featureId}\` has been researched, usecases identified, guides & artifacts generated. And adverserially reviewed. ${emoji}

> **${feature.name}**: ${feature.description}

### generated use cases

`;

  for (const uc of useCases) {
    const previewUrl = `https://github-preview-proxy-847799827363.us-central1.run.app/${repo}/${branch}/guides/${uc.category}/${uc.slug}/demo.html`;

    const escapedDescription = escapeLeftAngleBracket(uc.description);
    body += `- \`${uc.slug}\` - ${escapedDescription}\n`;
    body += `   - [demo](${previewUrl})\n`;
  }

  if (passRates && Object.keys(passRates).length > 0) {
    body += `\n### Initial Pass Rates\n\n`;
    body += `| Use Case | Unguided | Guided | Uplift |\n`;
    body += `| :--- | :---: | :---: | :---: |\n`;

    for (const uc of useCases) {
      const rates = passRates[uc.slug];
      if (rates) {
        const unguided = parseInt(rates.unguided, 10);
        const guided = parseInt(rates.guided, 10);
        const uplift = guided - unguided;
        const upliftStr = uplift >= 0 ? `+${uplift}%` : `${uplift}%`;

        body += `| \`${uc.slug}\` | ${rates.unguided}% | ${rates.guided}% | ${upliftStr} |\n`;
      }
    }
  }

  body += `\n---\n\nReviewer: Please ensure \`guide\` usecase is valid, and details are technically accurate, \`expectations\` criteria is accurate.  \n\n**Add a PR review** (after optionally leaving comments) to trigger a feedback iteration, where the agent will handle your feedback and push new commits.  (If you prefer, you can just push changes to the branch.)\n`;

  return body;
}

export async function commitAndPush(featureId: string): Promise<boolean> {
  const branch = `bot/${featureId}`;
  console.log(`Committing and pushing to ${branch}...`);

  // Check if there are changes
  const status = await runCommand('git', ['status', '--porcelain']);
  if (!status.trim()) {
    console.log('No changes to commit.');
    return false;
  }

  // Create or switch to branch
  try {
    await runCommand('git', ['checkout', '-b', branch]);
  } catch (err) {
    await runCommand('git', ['checkout', branch]);
  }

  await runCommand('git', ['add', 'guides/']);
  await runCommand('git', ['commit', '-m', `feat: scaffold guide for ${featureId}`]);

  await runCommand('git', ['push', 'origin', `${branch}:${branch}`, '--force']);
  console.log(`✅ Pushed to ${branch}`);
  return true;

}

export async function createPullRequest(featureId: string, body: string, reviewer?: string): Promise<void> {
  const branch = `bot/${featureId}`;
  console.log(`Creating PR for ${branch}...`);

  // Check if PR already exists
  try {
    const pr = await runCommand('gh', ['pr', 'view', branch]);
    if (pr) {
      console.log(`PR already exists for ${branch}. Skipping creation.`);
      return;
    }
  } catch (err) {
    // PR doesn't exist, continue
  }

  const title = `guides: ${featureId}`;

  const args = [
    'pr', 'create',
    '--draft',
    '--head', branch,
    '--title', title,
    '--body', body,
  ];

  if (reviewer) {
    args.push('--reviewer', reviewer);
  }

  await runCommand('gh', args);

  console.log(`✅ PR created for ${branch}`);
}

export async function handleGitAndPR(featureId: string, useCases: UseCase[], reviewer?: string, passRates?: Record<string, PassRates>): Promise<void> {
  if (process.env.GITHUB_ACTIONS) {
    const pushed = await commitAndPush(featureId);
    if (pushed) {
      const body = constructPRBody(featureId, useCases, passRates);
      await createPullRequest(featureId, body, reviewer);
    }
  } else {
    console.log('\nSkipping Git commit/push and PR creation (not running in GitHub Actions).');
  }
}
