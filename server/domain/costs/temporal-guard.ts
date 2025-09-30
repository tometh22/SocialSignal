import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export interface AnomalyConfig {
  lookback_months: number;
  low_ratio_threshold: number;
  high_ratio_threshold: number;
  min_baseline_points: number;
  mode: 'detect' | 'autocorrect';
  strategy: 'median' | 'prev_valid';
  max_gap_months: number;
  usd_tolerance_pct: number;
  log_level: string;
}

interface ConfigOverride {
  projectKey: string;
  low_ratio_threshold?: number;
  high_ratio_threshold?: number;
  strategy?: 'median' | 'prev_valid';
}

interface ConfigFile {
  version: string;
  defaults: AnomalyConfig;
  overrides: ConfigOverride[];
}

export interface AnomalyDecision {
  isAnomaly: boolean;
  ratio?: number;
  baselineUSD?: number | null;
  fixedUSD?: number | null;
  reason?: string;
  flags: string[];
}

let cachedConfig: ConfigFile | null = null;

export function loadAnomalyConfig(): ConfigFile {
  if (cachedConfig) return cachedConfig;

  try {
    const configPath = path.join(process.cwd(), 'config/anomaly.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    cachedConfig = yaml.load(fileContents) as ConfigFile;
    console.log('✅ Anomaly config loaded:', cachedConfig.version);
    return cachedConfig;
  } catch (error) {
    console.warn('⚠️ Could not load anomaly config, using defaults');
    return {
      version: '1.0',
      defaults: {
        lookback_months: 3,
        low_ratio_threshold: 0.35,
        high_ratio_threshold: 2.5,
        min_baseline_points: 2,
        mode: 'autocorrect',
        strategy: 'median',
        max_gap_months: 6,
        usd_tolerance_pct: 25,
        log_level: 'info'
      },
      overrides: []
    };
  }
}

export function getConfigForProject(projectKey: string): AnomalyConfig {
  const config = loadAnomalyConfig();
  const override = config.overrides.find(o => 
    projectKey.toLowerCase().includes(o.projectKey.toLowerCase())
  );

  if (override) {
    return {
      ...config.defaults,
      ...override
    };
  }

  return config.defaults;
}

export function buildBaselineUSD(history: number[]): number | null {
  const values = history.filter(x => Number.isFinite(x) && x > 0);
  if (values.length < 2) return null;

  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 
    ? values[mid] 
    : (values[mid - 1] + values[mid]) / 2;
}

export function temporalGuard(input: {
  projectKey: string;
  monthKey: string;
  nativeCurrency: 'ARS' | 'USD';
  costNative: number;
  fx: number;
  montoUSDFromOrigin: number | null;
  historyUSDNormalized: number[];
}): AnomalyDecision {
  const { 
    projectKey, 
    monthKey, 
    nativeCurrency, 
    costNative, 
    fx, 
    montoUSDFromOrigin, 
    historyUSDNormalized 
  } = input;

  const cfg = getConfigForProject(projectKey);
  const flags: string[] = [];

  const currentUSD = montoUSDFromOrigin ?? (
    nativeCurrency === 'ARS' ? costNative / fx : costNative
  );

  const baselineUSD = buildBaselineUSD(historyUSDNormalized);
  if (!baselineUSD) {
    return { isAnomaly: false, flags };
  }

  const ratio = currentUSD / baselineUSD;

  const isLow = ratio < cfg.low_ratio_threshold;
  const isHigh = ratio > cfg.high_ratio_threshold;

  if (!isLow && !isHigh) {
    return { isAnomaly: false, ratio, baselineUSD, flags };
  }

  flags.push('ANOMALY_TEMPORAL');
  let fixedUSD: number | null = null;
  let reason = '';

  if (cfg.mode === 'autocorrect') {
    if (cfg.strategy === 'prev_valid' && historyUSDNormalized.length > 0) {
      fixedUSD = historyUSDNormalized[0];
      reason = 'AUTO_FROM_PREV_VALID';
    } else {
      fixedUSD = baselineUSD;
      reason = 'AUTO_FROM_MEDIAN';
    }
    
    console.log(`🔧 TCG: ${projectKey} ${monthKey} - ratio=${ratio.toFixed(2)}, baseline=${baselineUSD.toFixed(0)}, fixed=${fixedUSD.toFixed(0)}`);
  } else {
    reason = 'DETECTED_ONLY';
  }

  return {
    isAnomaly: true,
    ratio,
    baselineUSD,
    fixedUSD,
    reason,
    flags
  };
}
