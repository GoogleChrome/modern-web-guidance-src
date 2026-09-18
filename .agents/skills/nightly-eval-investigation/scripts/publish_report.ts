import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../');
const reportPath = path.join(repoRoot, '.agents', 'skills', 'nightly-eval-investigation', 'artifacts', 'nightly_investigation_report.md');

function getSlug(taskName: string): string {
  return taskName.toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/\s+/g, '-');
}

function getOrCreateLabel(labelName: string, color: string, description: string) {
  try {
    console.log(`Checking/Creating label: "${labelName}"...`);
    execSync(`gh label create "${labelName}" --color "${color}" --description "${description}" || true`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore error if it already exists or if we lack permissions but want to try anyway
  }
}

async function main() {
  const dateStr = new Date().toISOString().split('T')[0];
  const createdIssues: { title: string; url: string; type: string }[] = [];

  // 1. Read the generated markdown report
  if (!fs.existsSync(reportPath)) {
    console.error(`❌ Error: Report file does not exist at ${reportPath}`);
    process.exit(1);
  }

  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  let parentBody = reportContent.replace(
    /- \*\*Actionable Recommendations\*\*:\n[\s\S]*?(?=\n---|$$)/g,
    ''
  );

  if (parentBody.length > 65536) {
    console.error(`❌ Error: The parent issue body size (${parentBody.length} characters) exceeds GitHub's limit of 65,536 characters.`);
    console.error(`Please adjust health thresholds in investigate.ts to reduce the number of flagged tasks.`);
    process.exit(1);
  }

  // 2. Create the parent issue on GitHub
  const parentTitle = `📋 Nightly Guidance Health Audit: ${dateStr}`;
  getOrCreateLabel('nightly-investigation', '1D76DB', 'Nightly Guidance Health Audits');
  console.log(`📦 Creating parent GitHub issue: "${parentTitle}"...`);
  
  let parentUrl = '';
  let parentNum = '';
  const tempReportPath = reportPath + '.parent.tmp';
  try {
    fs.writeFileSync(tempReportPath, parentBody, 'utf-8');
    const parentOutput = execSync(`gh issue create --title "${parentTitle}" --body-file "${tempReportPath}" --label "nightly-investigation"`, { encoding: 'utf-8' });
    parentUrl = parentOutput.trim();
    console.log(`✅ Parent issue created at: ${parentUrl}`);
    createdIssues.push({ title: parentTitle, url: parentUrl, type: 'parent' });
    const parentNumMatch = parentUrl.match(/\/issues\/(\d+)/);
    parentNum = parentNumMatch ? parentNumMatch[1] : '';
  } catch (err: any) {
    console.error('❌ Failed to create parent issue. Check GitHub CLI authentication.', err.message);
    if (fs.existsSync(tempReportPath)) fs.unlinkSync(tempReportPath);
    process.exit(1);
  } finally {
    if (fs.existsSync(tempReportPath)) fs.unlinkSync(tempReportPath);
  }

  // 3. Parse the report to find recommendations per task and create subissues
  const taskSections = reportContent.split(/(?=<a name="[^"]+"><\/a>\s*\n### `[^`]+`)/);
  if (taskSections.length <= 1) {
    console.log('ℹ️ No flagged tasks found or no task details generated.');
    return;
  }

  // Ensure labels exist
  getOrCreateLabel(`nightly-investigation-eng-${dateStr}`, '2B90B5', 'Engineering nightly investigation');
  getOrCreateLabel(`nightly-investigation-devrel-${dateStr}`, 'E27D60', 'Devrel nightly investigation');

  for (let i = 1; i < taskSections.length; i++) {
    const section = taskSections[i];
    const headerMatch = section.match(/### `([^`]+)`/);
    if (!headerMatch) continue;
    const taskName = headerMatch[1];
    
    // Parse metadata
    const runDetails: Record<string, { guided: string; unguided: string; guides: string }> = {};
    const agentLines = section.split('\n').filter(l => l.trim().startsWith('| **'));
    for (const line of agentLines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 5) {
        const agentName = parts[1].replace(/\*\*/g, '');
        runDetails[agentName] = {
          guided: parts[2],
          unguided: parts[3],
          guides: parts[4],
        };
      }
    }

    const flagsMatch = section.match(/#### Flags:\n([\s\S]*?)(?=\n#### Run Details:|\n#### Qualitative|\n- \*\*Actionable|$)/);
    const flags: string[] = [];
    if (flagsMatch) {
      const flagLines = flagsMatch[1].split('\n');
      for (const fl of flagLines) {
        const fm = fl.match(/-\s+\*\*`([^`]+)`\*\*/);
        if (fm) {
          flags.push(fm[1]);
        }
      }
    }

    // Parse recommendations
    const recommendationsMatch = section.match(/- \*\*Actionable Recommendations\*\*:\n([\s\S]*?)(?=\n---|$$)/);
    const recLines = (recommendationsMatch ? recommendationsMatch[1] : '').split('\n');
    let promptRec: { path?: string; detail: string } | null = null;
    let guideRec: { path?: string; detail: string } | null = null;
    let graderRec: { path?: string; detail: string } | null = null;

    for (const rl of recLines) {
      const m = rl.match(/^\s*-\s*\[[ x]?\]\s*\*\*(Prompt|Guide|Grader)\*\*\s*(?:\(`?([^`)]+)`?\))?:\s*(.*)$/i);
      if (m) {
        const type = m[1].toLowerCase();
        const filePath = m[2]?.trim();
        const detail = m[3]?.trim();
        if (detail && !detail.toUpperCase().includes('TODO')) {
          const rec = { path: filePath, detail };
          if (type === 'prompt') promptRec = rec;
          else if (type === 'guide') guideRec = rec;
          else if (type === 'grader') graderRec = rec;
        }
      }
    }

    const anchorUrl = `${parentUrl}#user-content-${getSlug(taskName)}`;

    // Create Grader Subissue (Engineering)
    if (graderRec) {
      const graderTitle = `Grader Fix: ${taskName} - ${dateStr}`;
      const graderBody = `### Grader Fix Recommendation for \`${taskName}\`

**Task / Guide**: \`${taskName}\`
**File to change**: \`${graderRec.path || 'Unknown'}\`
**Audit Report**: [Nightly Audit Report Issue #${parentNum}](${anchorUrl})

#### Recommended Grader Changes:
${graderRec.detail}

#### Run Details & Metadata:
- **Flags Triggered**: ${flags.map(f => `\`${f}\``).join(', ')}
${Object.entries(runDetails).map(([agent, details]) => `- **${agent}**: Guided Pass Rate: ${details.guided}, Unguided Pass Rate: ${details.unguided}, Guides Consumed: ${details.guides}`).join('\n')}`;

      console.log(`Creating Grader subissue: "${graderTitle}"...`);
      const tempGraderPath = path.join(repoRoot, `.agents/skills/nightly-eval-investigation/artifacts/grader_subissue_${taskName}.tmp`);
      try {
        fs.writeFileSync(tempGraderPath, graderBody, 'utf-8');
        const graderIssueUrl = execSync(
          `gh issue create --title "${graderTitle}" --body-file "${tempGraderPath}" --label "nightly-investigation-eng-${dateStr}"`,
          { encoding: 'utf-8' }
        ).trim();
        console.log(`✅ Grader subissue created: ${graderIssueUrl}`);
        createdIssues.push({ title: graderTitle, url: graderIssueUrl, type: 'eng-subissue' });
      } catch (err: any) {
        console.error(`❌ Failed to create Grader subissue:`, err.message);
      } finally {
        if (fs.existsSync(tempGraderPath)) fs.unlinkSync(tempGraderPath);
      }
    }

    // Create Task & Guide Subissue (Devrel)
    if (promptRec || guideRec) {
      const devrelTitle = `Task/Guide Fix: ${taskName} - ${dateStr}`;
      const devrelBody = `### Task & Guide Fix Recommendation for \`${taskName}\`

**Task / Guide**: \`${taskName}\`
**Files to change**:
${promptRec ? `- **Prompt**: \`${promptRec.path || 'Unknown'}\`` : ''}
${guideRec ? `- **Guide**: \`${guideRec.path || 'Unknown'}\`` : ''}
**Audit Report**: [Nightly Audit Report Issue #${parentNum}](${anchorUrl})

${promptRec ? `#### Recommended Prompt Changes:\n${promptRec.detail}\n` : ''}
${guideRec ? `#### Recommended Guide Changes:\n${guideRec.detail}\n` : ''}

#### Run Details & Metadata:
- **Flags Triggered**: ${flags.map(f => `\`${f}\``).join(', ')}
${Object.entries(runDetails).map(([agent, details]) => `- **${agent}**: Guided Pass Rate: ${details.guided}, Unguided Pass Rate: ${details.unguided}, Guides Consumed: ${details.guides}`).join('\n')}`;

      console.log(`Creating Devrel subissue: "${devrelTitle}"...`);
      const tempDevrelPath = path.join(repoRoot, `.agents/skills/nightly-eval-investigation/artifacts/devrel_subissue_${taskName}.tmp`);
      try {
        fs.writeFileSync(tempDevrelPath, devrelBody, 'utf-8');
        const devrelIssueUrl = execSync(
          `gh issue create --title "${devrelTitle}" --body-file "${tempDevrelPath}" --label "nightly-investigation-devrel-${dateStr}"`,
          { encoding: 'utf-8' }
        ).trim();
        console.log(`✅ Devrel subissue created: ${devrelIssueUrl}`);
        createdIssues.push({ title: devrelTitle, url: devrelIssueUrl, type: 'devrel-subissue' });

        // Add to Project 30 (Modern Web Guidance) and set Status to needs-investigation
        try {
          console.log(`Adding subissue to Project 30 (GoogleChrome)...`);
          const addOutput = execSync(
            `gh project item-add 30 --owner GoogleChrome --url "${devrelIssueUrl}" --format json`,
            { encoding: 'utf-8' }
          ).trim();
          const item = JSON.parse(addOutput);
          const itemId = item.id;

          // Fetch Project ID
          const projOutput = execSync(`gh project view 30 --owner GoogleChrome --format json`, { encoding: 'utf-8' }).trim();
          const proj = JSON.parse(projOutput);
          const projectId = proj.id;

          // Fetch fields and options to set Status field to needs-investigation
          const fieldsOutput = execSync(`gh project field-list 30 --owner GoogleChrome --format json`, { encoding: 'utf-8' }).trim();
          const fields = JSON.parse(fieldsOutput);
          const fieldsList = Array.isArray(fields) ? fields : fields.fields;
          const statusField = fieldsList.find((f: any) => f.name?.toLowerCase() === 'status');
          
          if (statusField) {
            const fieldId = statusField.id;
            const options = statusField.options || statusField.settings?.options || [];
            const needsInvestigationOption = options.find(
              (o: any) => o.name?.toLowerCase() === 'needs-investigation' || o.name?.toLowerCase() === 'needs investigation'
            );
            if (needsInvestigationOption) {
              const optionId = needsInvestigationOption.id;
              execSync(
                `gh project item-edit --id "${itemId}" --field-id "${fieldId}" --project-id "${projectId}" --single-select-option-id "${optionId}"`,
                { stdio: 'inherit' }
              );
              console.log(`✅ Successfully added to Project 30 and set Status to needs-investigation.`);
            } else {
              console.warn(`⚠️ Could not find "needs-investigation" option in Project 30 Status options.`);
            }
          } else {
            console.warn(`⚠️ Could not find "Status" field in Project 30 fields.`);
          }
        } catch (projErr: any) {
          console.error(`❌ Failed to integrate with Project 30:`, projErr.message);
        }
      } catch (err: any) {
        console.error(`❌ Failed to create Devrel subissue:`, err.message);
      } finally {
        if (fs.existsSync(tempDevrelPath)) fs.unlinkSync(tempDevrelPath);
      }
    }
  }

  // 4. Link all created subissues to the parent issue natively
  const subissues = createdIssues.filter(i => i.type !== 'parent');
  if (subissues.length > 0) {
    try {
      console.log(`🔗 Fetching GraphQL ID for parent issue...`);
      const parentNodeId = execSync(`gh issue view ${parentUrl} --json id --jq .id`, { encoding: 'utf-8' }).trim();
      
      for (const issue of subissues) {
        console.log(`🔗 Linking subissue "${issue.title}" to parent natively...`);
        try {
          const subIssueNodeId = execSync(`gh issue view ${issue.url} --json id --jq .id`, { encoding: 'utf-8' }).trim();
          const mutation = 'mutation($issueId: ID!, $subIssueId: ID!) { addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) { clientMutationId } }';
          execSync(`gh api graphql -f query='${mutation}' -f issueId="${parentNodeId}" -f subIssueId="${subIssueNodeId}"`, { stdio: 'ignore' });
        } catch (linkErr: any) {
          console.error(`❌ Failed to link subissue "${issue.title}":`, linkErr.message);
        }
      }
      console.log(`✅ Native sub-issue relationships established.`);
    } catch (parentErr: any) {
      console.error(`❌ Failed to fetch parent GraphQL ID:`, parentErr.message);
    }
  }

  console.log('\n📦 Summary of Created Issues:');
  for (const issue of createdIssues) {
    console.log(`- [${issue.type.toUpperCase()}] ${issue.title}`);
    console.log(`  Url: ${issue.url}`);
  }

  console.log('\n🎉 Nightly investigation publisher script completed!');
}

main().catch(console.error);
