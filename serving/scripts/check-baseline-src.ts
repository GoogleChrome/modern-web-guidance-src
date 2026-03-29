/**
 * @file check-baseline-src.ts
 * @description Source logic for the Baseline Checking CLI. Imports standard 
 * Baseline resolution logic from the production workspace server.
 * 
 * This file is NOT run directly. It is bundled by `sync-baseline-features.ts` 
 * into the self-contained `check-baseline.js` for automated agents.
 */

import { resolveFeatureId } from '../mcp-server/data/baseline.ts';
import { features } from 'web-features'; // Will be aliased to mini-features during esbuild

interface Feature {
  name: string;
  kind: string;
  status?: {
    baseline?: string;
    baseline_low_date?: string;
    baseline_high_date?: string;
    support?: Record<string, string>;
  };
}

function checkBaseline(target: string, featureId: string): boolean {
  const resolvedIds = resolveFeatureId(featureId);
  if (resolvedIds.length === 0) return false;

  // We consider it available if EVERY resolved feature (in case of splits) meets the target
  return resolvedIds.every(id => {
    const feature = features[id] as any as Feature;
    if (!feature) return false;
    return evaluateTarget(target, feature);
  });
}

function evaluateTarget(target: string, feature: Feature): boolean {
  const normalizedTarget = target.toLowerCase().trim();

  if (normalizedTarget.includes('limited availability')) {
    return true; // Ignore compatibility checks
  }

  const status = feature.status;
  if (!status || !status.baseline) {
    return false; // Feature is not baseline yet
  }

  if (normalizedTarget.includes('widely available')) {
    return status.baseline === 'high';
  }

  if (normalizedTarget.includes('newly available') || normalizedTarget === 'baseline') {
    return status.baseline === 'low' || status.baseline === 'high';
  }

  // Handle 'baseline YYYY'
  const yearMatch = normalizedTarget.match(/baseline (\d{4})/);
  if (yearMatch) {
    if (!status.baseline_low_date) return false;
    const releaseYear = status.baseline_low_date.split('-')[0];
    return parseInt(releaseYear, 10) <= parseInt(yearMatch[1], 10);
  }

  // Handle 'baseline widely available on YYYY-MM-DD'
  const dateMatch = normalizedTarget.match(/baseline widely available on (\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    if (status.baseline !== 'high' || !status.baseline_high_date) return false;
    return status.baseline_high_date <= dateMatch[1];
  }

  return false;
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node check-baseline.js <command> <args...>');
  console.log('Commands:');
  console.log('  lookup <feature-id>');
  console.log('  reconcile <target> <feature-id>');
  process.exit(0);
}

const command = args[0];

if (command === 'lookup') {
  const featureId = args[1];
  const resolvedIds = resolveFeatureId(featureId);
  
  if (resolvedIds.length === 0) {
    console.log(`Feature ${featureId} not found.`);
    process.exit(1);
  }
  
  if (resolvedIds.length === 1 && resolvedIds[0] === featureId) {
    console.log(`Feature ${featureId} is canonical.`);
  } else {
    console.log(`Feature ${featureId} resolved to canonical ID(s): ${resolvedIds.join(', ')}`);
  }
} else if (command === 'reconcile') {
  const target = args[1];
  const featureId = args[2] || args[1]; // Fallback if positional args shift
  
  const isOk = checkBaseline(target, featureId);
  if (isOk) {
    console.log(`Feature ${featureId} meets target ${target}`);
    process.exit(0);
  } else {
    console.log(`Feature ${featureId} does NOT meet target ${target}`);
    process.exit(1);
  }
}
