export type TaskName = 'autocomplete' | 'embedding';

export interface ModelConfig {
  provider: string;
  endpoint: string;
  model: string;
  apiKeyEnv: string;
  maxTokens: number;
  temperature: number;
  tasks: TaskName[];
}

export interface RagConfig {
  persistCache: boolean;
  workspaceIndexing: boolean;
  maxWorkspaceFiles: number;
  chunkTargetLines: number;
  chunkOverlapLines: number;
  chunkRespectBoundaries: boolean;
  indexBatchSize: number;
  indexBatchDelayMs: number;
  saveDebounceSec: number;
}

export type LogVerbosity = 'off' | 'minimal' | 'verbose';

export interface AutocompleteConfig {
  enabled: boolean;
  debounceMs: number;
  maxContextLines: number;
  disabledExtensions: string[];
  logVerbosity: LogVerbosity;
  models: Record<string, ModelConfig>;
  rag: RagConfig;
}

const ENV_VAR_NAME_RE = /^[A-Z_][A-Z0-9_]*$/i;
const PROVIDER_RE = /^[a-zA-Z0-9-]+$/;

function isValidEnvVarName(name: unknown): name is string {
  return typeof name === 'string' && ENV_VAR_NAME_RE.test(name);
}

function isValidProvider(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && PROVIDER_RE.test(value);
}

function isValidEndpoint(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 2048 &&
    (value.startsWith('http://') || value.startsWith('https://'))
  );
}

const VALID_TASK_NAMES: TaskName[] = ['autocomplete', 'embedding'];

const DEFAULT_CODESTRAL: ModelConfig = {
  provider: 'openai-compatible',
  endpoint: 'https://api.mistral.ai/v1/chat/completions',
  model: 'codestral-latest',
  apiKeyEnv: 'MISTRAL_API_KEY',
  maxTokens: 128,
  temperature: 0.0,
  tasks: ['autocomplete'],
};

const DEFAULT_EMBEDDER: ModelConfig = {
  provider: 'openai-compatible',
  endpoint: 'https://api.openai.com/v1/embeddings',
  model: 'text-embedding-3-small',
  apiKeyEnv: 'OPENAI_API_KEY',
  maxTokens: 0,
  temperature: 0.0,
  tasks: ['embedding'],
};

const DEFAULT_MODELS: Record<string, ModelConfig> = {
  codestral: DEFAULT_CODESTRAL,
  embedder: DEFAULT_EMBEDDER,
};

function cloneModels(models: Record<string, ModelConfig>): Record<string, ModelConfig> {
  const result: Record<string, ModelConfig> = {};
  for (const [name, model] of Object.entries(models)) {
    result[name] = { ...model, tasks: [...model.tasks] };
  }
  return result;
}

const DEFAULT_RAG: RagConfig = {
  persistCache: true,
  workspaceIndexing: true,
  maxWorkspaceFiles: 1000,
  chunkTargetLines: 30,
  chunkOverlapLines: 5,
  chunkRespectBoundaries: true,
  indexBatchSize: 5,
  indexBatchDelayMs: 100,
  saveDebounceSec: 30,
};

const VALID_VERBOSITY: LogVerbosity[] = ['off', 'minimal', 'verbose'];

const DEFAULTS: AutocompleteConfig = {
  enabled: true,
  debounceMs: 300,
  maxContextLines: 50,
  disabledExtensions: ['.md', '.txt'],
  logVerbosity: 'off',
  models: cloneModels(DEFAULT_MODELS),
  rag: { ...DEFAULT_RAG },
};

let currentConfig: AutocompleteConfig = {
  ...DEFAULTS,
  models: cloneModels(DEFAULT_MODELS),
  rag: { ...DEFAULT_RAG },
};

export function getConfig(): AutocompleteConfig {
  return currentConfig;
}

export function getModelForTask(task: TaskName): ModelConfig | null {
  for (const model of Object.values(currentConfig.models)) {
    if (model.tasks.includes(task)) return model;
  }
  return null;
}

export function getApiKeyForTask(task: TaskName): string {
  const model = getModelForTask(task);
  if (model === null) return '';
  return editor.getEnv(model.apiKeyEnv);
}

export function getApiKey(): string {
  return getApiKeyForTask('autocomplete');
}

function isValidTaskName(value: unknown): value is TaskName {
  return typeof value === 'string' && VALID_TASK_NAMES.includes(value as TaskName);
}

function validateModelConfig(
  name: string,
  config: ModelConfig,
  claimedTasks: Set<TaskName>,
): ModelConfig | null {
  const result = { ...config, tasks: [...config.tasks] };

  if (!isValidProvider(result.provider)) {
    editor.setStatus(`AI: invalid provider for model "${name}" - skipped`);
    return null;
  }
  if (!isValidEndpoint(result.endpoint)) {
    editor.setStatus(`AI: invalid endpoint for model "${name}" - skipped`);
    return null;
  }
  if (!isValidEnvVarName(result.apiKeyEnv)) {
    editor.setStatus(`AI: invalid apiKeyEnv for model "${name}" - skipped`);
    return null;
  }
  if (typeof result.maxTokens !== 'number' || result.maxTokens < 0) {
    result.maxTokens = 0;
  }
  result.maxTokens = Math.min(result.maxTokens, 4096);
  if (typeof result.temperature !== 'number' || result.temperature < 0) {
    result.temperature = 0;
  }
  result.temperature = Math.min(result.temperature, 2);

  // Filter tasks: must be valid and not already claimed by another model
  result.tasks = result.tasks.filter((t) => {
    if (!isValidTaskName(t)) return false;
    if (claimedTasks.has(t)) return false;
    claimedTasks.add(t);
    return true;
  });

  if (result.tasks.length === 0) {
    editor.setStatus(`AI: model "${name}" has no valid tasks - skipped`);
    return null;
  }

  return result;
}

function applyEnvOverrides(): void {
  for (const task of VALID_TASK_NAMES) {
    const prefix = `AI_${task.toUpperCase()}`;

    const envProvider = editor.getEnv(`${prefix}_PROVIDER`);
    const envEndpoint = editor.getEnv(`${prefix}_ENDPOINT`);
    const envModel = editor.getEnv(`${prefix}_MODEL`);
    const envApiKeyEnv = editor.getEnv(`${prefix}_API_KEY_ENV`);

    // If any env var is set, find or create the model for this task
    if (envProvider === '' && envEndpoint === '' && envModel === '' && envApiKeyEnv === '')
      continue;

    let model = getModelForTask(task);

    if (model === null) {
      // Create a model from defaults
      const defaultForTask = Object.values(DEFAULT_MODELS).find((m) => m.tasks.includes(task));
      if (defaultForTask === undefined) continue;
      const name = `env-${task}`;
      model = { ...defaultForTask, tasks: [task] };
      currentConfig.models[name] = model;
    }

    if (envProvider !== '') {
      if (isValidProvider(envProvider)) {
        model.provider = envProvider;
      } else {
        editor.setStatus(`AI: invalid ${prefix}_PROVIDER - ignored`);
      }
    }
    if (envEndpoint !== '') {
      if (isValidEndpoint(envEndpoint)) {
        model.endpoint = envEndpoint;
      } else {
        editor.setStatus(`AI: invalid ${prefix}_ENDPOINT - ignored`);
      }
    }
    if (envModel !== '') {
      model.model = envModel;
    }
    if (envApiKeyEnv !== '') {
      if (isValidEnvVarName(envApiKeyEnv)) {
        model.apiKeyEnv = envApiKeyEnv;
      } else {
        editor.setStatus(`AI: invalid ${prefix}_API_KEY_ENV - ignored`);
      }
    }
  }
}

export async function loadConfig(): Promise<AutocompleteConfig> {
  const configDir = editor.getConfigDir();
  const configPath = editor.pathJoin([configDir, 'ai-autocomplete.json']);

  currentConfig = {
    ...DEFAULTS,
    models: cloneModels(DEFAULT_MODELS),
    rag: { ...DEFAULT_RAG },
  };

  if (editor.fileExists(configPath)) {
    try {
      const raw = await editor.readFile(configPath);
      const rawParsed: unknown = JSON.parse(raw);
      if (typeof rawParsed !== 'object' || rawParsed === null) throw new Error('invalid config');
      const parsed = rawParsed as Record<string, unknown>;

      // Global fields
      if (typeof parsed['enabled'] === 'boolean') currentConfig.enabled = parsed['enabled'];
      if (typeof parsed['debounceMs'] === 'number' && parsed['debounceMs'] >= 0)
        currentConfig.debounceMs = parsed['debounceMs'];
      if (typeof parsed['maxContextLines'] === 'number' && parsed['maxContextLines'] >= 1)
        currentConfig.maxContextLines = parsed['maxContextLines'];
      if (Array.isArray(parsed['disabledExtensions']))
        currentConfig.disabledExtensions = parsed['disabledExtensions'] as string[];
      if (typeof parsed['logVerbosity'] === 'string' && VALID_VERBOSITY.includes(parsed['logVerbosity'] as LogVerbosity))
        currentConfig.logVerbosity = parsed['logVerbosity'] as LogVerbosity;

      // RAG config
      if (typeof parsed['rag'] === 'object' && parsed['rag'] !== null) {
        const ragObj = parsed['rag'] as Record<string, unknown>;
        if (typeof ragObj['persistCache'] === 'boolean')
          currentConfig.rag.persistCache = ragObj['persistCache'];
        if (typeof ragObj['workspaceIndexing'] === 'boolean')
          currentConfig.rag.workspaceIndexing = ragObj['workspaceIndexing'];
        if (typeof ragObj['maxWorkspaceFiles'] === 'number' && ragObj['maxWorkspaceFiles'] >= 1)
          currentConfig.rag.maxWorkspaceFiles = ragObj['maxWorkspaceFiles'];
        if (typeof ragObj['chunkTargetLines'] === 'number' && ragObj['chunkTargetLines'] >= 1)
          currentConfig.rag.chunkTargetLines = ragObj['chunkTargetLines'];
        if (typeof ragObj['chunkOverlapLines'] === 'number' && ragObj['chunkOverlapLines'] >= 0)
          currentConfig.rag.chunkOverlapLines = ragObj['chunkOverlapLines'];
        if (typeof ragObj['chunkRespectBoundaries'] === 'boolean')
          currentConfig.rag.chunkRespectBoundaries = ragObj['chunkRespectBoundaries'];
        if (typeof ragObj['indexBatchSize'] === 'number' && ragObj['indexBatchSize'] >= 1)
          currentConfig.rag.indexBatchSize = ragObj['indexBatchSize'];
        if (typeof ragObj['indexBatchDelayMs'] === 'number' && ragObj['indexBatchDelayMs'] >= 0)
          currentConfig.rag.indexBatchDelayMs = ragObj['indexBatchDelayMs'];
        if (typeof ragObj['saveDebounceSec'] === 'number' && ragObj['saveDebounceSec'] >= 0)
          currentConfig.rag.saveDebounceSec = ragObj['saveDebounceSec'];
      }

      if (typeof parsed['models'] === 'object' && parsed['models'] !== null) {
        // New model-centric config
        const modelsObj = parsed['models'] as Record<string, unknown>;
        const claimedTasks = new Set<TaskName>();
        const validatedModels: Record<string, ModelConfig> = {};

        for (const [name, raw] of Object.entries(modelsObj)) {
          if (typeof raw !== 'object' || raw === null) continue;
          const rawModel = raw as Record<string, unknown>;

          const candidate: ModelConfig = {
            provider: typeof rawModel['provider'] === 'string' ? rawModel['provider'] : '',
            endpoint: typeof rawModel['endpoint'] === 'string' ? rawModel['endpoint'] : '',
            model: typeof rawModel['model'] === 'string' ? rawModel['model'] : '',
            apiKeyEnv: typeof rawModel['apiKeyEnv'] === 'string' ? rawModel['apiKeyEnv'] : '',
            maxTokens: typeof rawModel['maxTokens'] === 'number' ? rawModel['maxTokens'] : 0,
            temperature: typeof rawModel['temperature'] === 'number' ? rawModel['temperature'] : 0,
            tasks: Array.isArray(rawModel['tasks']) ? (rawModel['tasks'] as TaskName[]) : [],
          };

          const validated = validateModelConfig(name, candidate, claimedTasks);
          if (validated !== null) {
            validatedModels[name] = validated;
          }
        }

        // Fill in default models for unclaimed tasks
        for (const task of VALID_TASK_NAMES) {
          if (!claimedTasks.has(task)) {
            const defaultEntry = Object.entries(DEFAULT_MODELS).find(([, m]) =>
              m.tasks.includes(task),
            );
            if (defaultEntry !== undefined) {
              const [defaultName, defaultModel] = defaultEntry;
              validatedModels[defaultName] = { ...defaultModel, tasks: [task] };
            }
          }
        }

        currentConfig.models = validatedModels;
      } else if (
        'provider' in parsed ||
        'model' in parsed ||
        'endpoint' in parsed ||
        'apiKeyEnv' in parsed
      ) {
        // Legacy flat config — create a single 'default' model for autocomplete
        const legacy: Partial<ModelConfig> = { tasks: ['autocomplete'] };
        if (typeof parsed['provider'] === 'string') legacy.provider = parsed['provider'];
        if (typeof parsed['endpoint'] === 'string') legacy.endpoint = parsed['endpoint'];
        if (typeof parsed['model'] === 'string') legacy.model = parsed['model'];
        if (typeof parsed['apiKeyEnv'] === 'string') legacy.apiKeyEnv = parsed['apiKeyEnv'];
        if (typeof parsed['maxTokens'] === 'number') legacy.maxTokens = parsed['maxTokens'];
        if (typeof parsed['temperature'] === 'number') legacy.temperature = parsed['temperature'];

        const claimedTasks = new Set<TaskName>();
        const base = DEFAULT_CODESTRAL;
        const candidate: ModelConfig = {
          provider: typeof legacy.provider === 'string' ? legacy.provider : base.provider,
          endpoint: typeof legacy.endpoint === 'string' ? legacy.endpoint : base.endpoint,
          model: typeof legacy.model === 'string' ? legacy.model : base.model,
          apiKeyEnv: typeof legacy.apiKeyEnv === 'string' ? legacy.apiKeyEnv : base.apiKeyEnv,
          maxTokens: typeof legacy.maxTokens === 'number' ? legacy.maxTokens : base.maxTokens,
          temperature:
            typeof legacy.temperature === 'number' ? legacy.temperature : base.temperature,
          tasks: ['autocomplete'],
        };
        const validated = validateModelConfig('default', candidate, claimedTasks);

        const models: Record<string, ModelConfig> = {};
        if (validated !== null) {
          models['default'] = validated;
        }

        // Add default embedder
        const embedderDefault = DEFAULT_EMBEDDER;
        models['embedder'] = { ...embedderDefault, tasks: ['embedding'] };
        currentConfig.models = models;
      }
    } catch {
      editor.setStatus('AI Autocomplete: config parse error - using defaults');
    }
  }

  // Per-task env var overrides
  applyEnvOverrides();

  return currentConfig;
}

export function setEnabled(enabled: boolean): void {
  currentConfig.enabled = enabled;
}

export function isExtensionDisabled(filePath: string): boolean {
  const ext = editor.pathExtname(filePath);
  return currentConfig.disabledExtensions.includes(ext);
}
