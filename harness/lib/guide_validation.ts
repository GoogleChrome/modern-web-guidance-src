import fs from 'fs';
import path from 'path';
import { config } from '../config.ts';
import { ResourceUsed } from './metrics.ts';

export interface GuideCheck {
  id: string;
  passed: boolean;
  message: string;
}

export interface GuideValidationResult {
  checks: GuideCheck[];
  resourcesUsed: ResourceUsed[] | null;
}

export async function checkGuides(dirPath: string, appName: string): Promise<GuideValidationResult> {
  const resourcesPath = path.join(dirPath, 'resources_used.json');
  
  if (!fs.existsSync(resourcesPath)) {
    return {
      checks: [{
        id: 'resources-exist',
        passed: false,
        message: 'resources_used.json not found'
      }],
      resourcesUsed: null
    };
  }

  let resources: ResourceUsed[];
  try {
    resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));
  } catch {
    return {
      checks: [{
        id: 'resources-valid-json',
        passed: false,
        message: 'resources_used.json is not valid JSON'
      }],
      resourcesUsed: null
    };
  }

  const checks: GuideCheck[] = [{
    id: 'resources-exist',
    passed: true,
    message: 'resources_used.json found'
  }];

  const expected = config.eval.expectedGuides[appName] || [];
  
  // Extract all resource names for easier searching
  const resourceNames = resources.map(r => r.name || '').filter(Boolean);

  for (const guide of expected) {
    // Check if any resource name contains the guide name
    const found = resourceNames.some(name => name.includes(guide));
    checks.push({
      id: `guide-${guide}`,
      passed: found,
      message: found 
        ? `Guide "${guide}" used` 
        : `Guide "${guide}" NOT found in resources`
    });
  }

  return {
    checks,
    resourcesUsed: resources
  };
}
