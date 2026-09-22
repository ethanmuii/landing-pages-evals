import Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callStructuralJudge, type JudgeCall } from '../../src/judge/call.js';
import { DEFAULT_JUDGE_MODEL, type JudgeConfig } from '../../src/judge/config.js';
import { buildStructuralJudgeRequest } from '../../src/judge/request.js';

const input = { baselineHtml: '<a></a>', generatedHtml: '<b></b>' };
const config: JudgeConfig = { model: 'my-model', maxTokens: 1234 };

const resolving = (value: unknown): JudgeCall => vi.fn<JudgeCall>().mockResolvedValue(value);
const rejecting = (error: unknown): JudgeCall => vi.fn<JudgeCall>().mockRejectedValue(error);

const apiError = <S extends number, T>(
  Class: new (status: S, error: undefined, message: undefined, headers: Headers) => T,
  status: S,
): T => new Class(status, undefined, undefined, new Headers());

describe('successful call', () => {
  it('returns the decided outcome', async () => {
    const call = resolving({ verdict: 'pass', confidence: 0.9, reason: 'Structure preserved.' });

    await expect(callStructuralJudge(input, call, config)).resolves.toEqual({
      status: 'decided',
      verdict: 'pass',
      confidence: 0.9,
      reason: 'Structure preserved.',
    });
  });

  it('sends exactly the built request with the decided timeout and retry budget', async () => {
    const call = resolving({ verdict: 'pass', confidence: 0.9, reason: 'Structure preserved.' });
    await callStructuralJudge(input, call, config);

    const expected = buildStructuralJudgeRequest(input, config);
    const [request, options] = vi.mocked(call).mock.calls[0] ?? [];

    expect(call).toHaveBeenCalledTimes(1);
    // zodOutputFormat attaches a fresh parse closure to every build, so the
    // format is compared by shape rather than by reference.
    expect(request).toEqual({
      ...expected,
      output_config: { format: { ...expected.output_config?.format, parse: expect.any(Function) } },
    });
    expect(options).toEqual({ timeout: 30_000, maxRetries: 2 });
  });

  it('delegates low confidence to the interpreter, keeping the model reason', async () => {
    const call = resolving({ verdict: 'fail', confidence: 0.4, reason: 'Unsure whether the wrapper is decorative.' });

    await expect(callStructuralJudge(input, call, config)).resolves.toEqual({
      status: 'needs_review',
      reason: 'Unsure whether the wrapper is decorative.',
    });
  });

  it('sends a malformed body to review', async () => {
    const call = resolving({ verdict: 'maybe' });

    await expect(callStructuralJudge(input, call, config)).resolves.toEqual({
      status: 'needs_review',
      reason: 'Structural judge returned malformed output.',
    });
  });
});

describe('credential failures', () => {
  it.each([
    ['authentication', apiError(Anthropic.AuthenticationError, 401)],
    ['permission denied', apiError(Anthropic.PermissionDeniedError, 403)],
  ])('rethrows the original %s error instance', async (_label, error) => {
    await expect(callStructuralJudge(input, rejecting(error), config)).rejects.toBe(error);
  });
});

describe('transport failures', () => {
  const cases: [string, unknown, string][] = [
    ['a timeout', new Anthropic.APIConnectionTimeoutError({ message: 'timed out' }), 'Structural judge timed out.'],
    [
      'a connection failure',
      new Anthropic.APIConnectionError({ message: 'socket hang up' }),
      'Structural judge could not be reached.',
    ],
    ['a rate limit', apiError(Anthropic.RateLimitError, 429), 'Structural judge was rate limited.'],
    ['a server error', apiError(Anthropic.InternalServerError, 500), 'Structural judge failed with status 500.'],
    ['a bad request', apiError(Anthropic.BadRequestError, 400), 'Structural judge failed with status 400.'],
    ['a not found', apiError(Anthropic.NotFoundError, 404), 'Structural judge failed with status 404.'],
    ['a plain error', new Error('boom'), 'Structural judge failed unexpectedly.'],
    ['a thrown string', 'boom', 'Structural judge failed unexpectedly.'],
  ];

  it.each(cases)('routes %s to review', async (_label, error, reason) => {
    await expect(callStructuralJudge(input, rejecting(error), config)).resolves.toEqual({
      status: 'needs_review',
      reason,
    });
  });

  it.each(cases)('never throws for %s', async (_label, error) => {
    await expect(callStructuralJudge(input, rejecting(error), config)).resolves.toHaveProperty(
      'status',
      'needs_review',
    );
  });

  it('never interpolates the error message into the reason', async () => {
    const outcome = await callStructuralJudge(input, rejecting(new Error('api key sk-secret leaked')), config);

    expect(JSON.stringify(outcome)).not.toContain('sk-secret');
  });
});

describe('default configuration', () => {
  const variables = ['STRUCTURAL_JUDGE_MODEL', 'STRUCTURAL_JUDGE_MAX_TOKENS'] as const;
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of variables) {
      saved.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of variables) {
      const value = saved.get(name);
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('resolves the config from the environment when it is omitted', async () => {
    const call = resolving({ verdict: 'pass', confidence: 0.9, reason: 'Structure preserved.' });
    await callStructuralJudge(input, call);

    const [request] = vi.mocked(call).mock.calls[0] ?? [];
    expect(request?.model).toBe(DEFAULT_JUDGE_MODEL);
  });
});
