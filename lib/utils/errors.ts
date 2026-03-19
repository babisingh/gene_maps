// ============================================================
// Custom error classes for Gene-Maps
// Use these instead of bare Error to get structured context.
// ============================================================

export class ExternalAPIError extends Error {
  constructor(
    public readonly service: string,
    public readonly endpoint: string,
    public readonly statusCode?: number,
    message?: string
  ) {
    super(message ?? `${service} API unreachable at ${endpoint}`);
    this.name = 'ExternalAPIError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(
    public readonly database: 'neo4j' | 'postgres' | 'redis',
    message?: string
  ) {
    super(message ?? `Failed to connect to ${database}`);
    this.name = 'DatabaseConnectionError';
  }
}

export class GeneNotFoundError extends Error {
  constructor(public readonly geneSymbol: string) {
    super(`Gene not found: ${geneSymbol}`);
    this.name = 'GeneNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Convert any caught value into a plain string for logging. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
