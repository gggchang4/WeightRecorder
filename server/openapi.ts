const json = (schema: unknown) => ({ 'application/json': { schema } });
const response = (description: string, schema: unknown) => ({ description, content: json(schema) });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const envelope = (schema: unknown) => ({ type: 'object', properties: { data: schema }, required: ['data'] });
const body = (schema: unknown) => ({ required: true, content: json(schema) });
const errorResponses = {
  '400': response('Validation error', ref('Error')),
  '403': response('Local origin required', ref('Error')),
  '404': response('Not found', ref('Error')),
  '409': response('A record for this date already exists', ref('Error')),
};
const entryInput = {
  type: 'object', required: ['date', 'weightKg'],
  properties: {
    date: { type: 'string', format: 'date', description: 'Local calendar day, not in the future; one record per date.' },
    weightKg: { type: 'number', minimum: 1, maximum: 500, description: 'Canonical storage unit is always kg.' },
    note: { type: 'string', maxLength: 500, default: '' },
    mood: { type: 'string', enum: ['good', 'neutral', 'tired'], default: 'neutral' },
  },
};
const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export const openapi = {
  openapi: '3.1.0',
  info: { title: '轻迹 · Weight Recorder API', version: '1.0.0', description: 'Local-only REST contract for future iOS and agent adapters. No cloud or LLM provider is connected. Mutations require JSON and a local origin.' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/health': { get: { operationId: 'health', responses: { '200': response('Local server status', envelope({ type: 'object' })) } } },
    '/snapshot': { get: { operationId: 'getSnapshot', responses: { '200': response('All entries and preferences', envelope(ref('Snapshot'))) } } },
    '/entries': {
      get: { operationId: 'listWeightEntries', parameters: ['from', 'to'].map(name => ({ name, in: 'query', schema: { type: 'string', format: 'date' } })), responses: { '200': response('Entries ordered by date ascending', envelope({ type: 'array', items: ref('Entry') })), ...errorResponses } },
      post: { operationId: 'recordWeight', requestBody: body(ref('EntryInput')), responses: { '201': response('Created', envelope(ref('Entry'))), ...errorResponses } },
    },
    '/entries/{id}': {
      put: { operationId: 'updateWeightEntry', parameters: [idParameter], requestBody: body(ref('EntryInput')), responses: { '200': response('Updated', envelope(ref('Entry'))), ...errorResponses } },
      delete: { operationId: 'deleteWeightEntry', parameters: [idParameter], responses: { '204': { description: 'Deleted' }, ...errorResponses } },
    },
    '/settings': { patch: { operationId: 'updatePreferences', requestBody: body({ ...ref('Settings') }), responses: { '200': response('Updated preferences', envelope(ref('Settings'))), ...errorResponses } } },
    '/summary': { get: { operationId: 'getWeightSummary', parameters: [{ name: 'asOf', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': response('Calendar based descriptive statistics. No diagnosis or forecast.', envelope({ type: 'object' })), ...errorResponses } } },
    '/export': { get: { operationId: 'exportData', parameters: [{ name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } }], responses: { '200': { description: 'Versioned JSON backup or UTF-8 CSV (kg)', content: { ...json(ref('Backup')), 'text/csv': { schema: { type: 'string' } } } } } } },
    '/import': { post: { operationId: 'importBackup', description: 'Atomic merge by date. Existing local dates win. Restores preferences. Validates the entire backup before committing.', requestBody: body(ref('Backup')), responses: { '200': response('Import counts', envelope({ type: 'object', properties: { imported: { type: 'integer' }, skipped: { type: 'integer' } } })), ...errorResponses } } },
    '/agent/context': { get: { operationId: 'getAgentContext', description: 'Read-only factual context for a future agent. No model requests are made.', responses: { '200': response('Summary and recent measurements with interpretation limits', envelope({ type: 'object' })) } } },
  },
  components: {
    schemas: {
      EntryInput: entryInput,
      Entry: { allOf: [entryInput, { type: 'object', required: ['id', 'createdAt', 'updatedAt'], properties: { id: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } }] },
      Settings: { type: 'object', properties: {
        displayName: { type: 'string', minLength: 1, maxLength: 30 },
        heightCm: { type: ['number', 'null'], minimum: 50, maximum: 260 },
        targetWeightKg: { type: ['number', 'null'], minimum: 1, maximum: 500 },
        unit: { type: 'string', enum: ['kg', 'lb'] },
        theme: { type: 'string', enum: ['light', 'dark', 'system'] },
      } },
      Snapshot: { type: 'object', required: ['entries', 'settings'], properties: { entries: { type: 'array', items: ref('Entry') }, settings: ref('Settings') } },
      Backup: { allOf: [ref('Snapshot'), { type: 'object', required: ['format', 'version', 'exportedAt'], properties: { format: { const: 'qingji-backup' }, version: { const: 1 }, exportedAt: { type: 'string' } } }] },
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: { type: 'array' } } } } },
    },
  },
};
