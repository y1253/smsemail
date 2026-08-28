import { UnauthorizedException } from '@nestjs/common';
import { AuthService, SESSION_INVALID } from './auth.service';

// The SPA signs a user out on `code: SESSION_INVALID` and nothing else, so what
// these tests really pin down is which failures carry it and which reason each
// one reports.
describe('AuthService.validCustomer', () => {
  let jwt: { verify: jest.Mock };
  let repo: { findOne: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    repo = { findOne: jest.fn() };
    service = new AuthService(jwt as any, repo as any);
  });

  const req = (token?: string) =>
    ({ headers: token ? { 'x-token': token } : {} }) as any;

  /** Runs the guard and hands back the exception's response payload. */
  const failure = async (request: any) => {
    try {
      await service.validCustomer(request);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      return (err as UnauthorizedException).getResponse() as any;
    }
    throw new Error('expected validCustomer to throw');
  };

  it('rejects a request with no x-token header', async () => {
    const body = await failure(req());
    expect(body).toMatchObject({
      statusCode: 401,
      code: SESSION_INVALID,
      reason: 'invalid',
      message: 'Missing token',
    });
  });

  it('reports an expired token as expired', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    const body = await failure(req('expired.jwt.here'));
    expect(body.code).toBe(SESSION_INVALID);
    expect(body.reason).toBe('expired');
    expect(body.message).toMatch(/expired/i);
  });

  it('does not call a forged token expired', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const body = await failure(req('forged.jwt.here'));
    expect(body).toMatchObject({ code: SESSION_INVALID, reason: 'invalid' });
    expect(body.message).toBe('Invalid token');
  });

  it('rejects a well-signed token whose user row is gone', async () => {
    jwt.verify.mockResolvedValue({ user_id: 7, email: 'a@b.c', tv: 0 });
    repo.findOne.mockResolvedValue(null);

    const body = await failure(req('good.jwt.here'));
    expect(body).toMatchObject({ code: SESSION_INVALID, reason: 'invalid' });
  });

  it('rejects a token stranded by a password change', async () => {
    jwt.verify.mockResolvedValue({ user_id: 7, email: 'a@b.c', tv: 1 });
    repo.findOne.mockResolvedValue({ userId: 7, tokenVersion: 2 });

    const body = await failure(req('stale.jwt.here'));
    expect(body).toMatchObject({ code: SESSION_INVALID, reason: 'revoked' });
    expect(body.message).toMatch(/password was changed/i);
  });

  it('admits a current token and attaches the payload to the request', async () => {
    const payload = { user_id: 7, email: 'a@b.c', tv: 3 };
    jwt.verify.mockResolvedValue(payload);
    repo.findOne.mockResolvedValue({ userId: 7, tokenVersion: 3 });

    const request = req('good.jwt.here');
    await expect(service.validCustomer(request)).resolves.toBe(true);
    expect(request.user).toBe(payload);
  });

  it('admits a legacy token with no tv against a generation-0 row', async () => {
    // Tokens minted before the token_version column existed carry no tv. They
    // must keep working, or deploying the column signs everyone out.
    jwt.verify.mockResolvedValue({ user_id: 7, email: 'a@b.c' });
    repo.findOne.mockResolvedValue({ userId: 7, tokenVersion: null });

    await expect(service.validCustomer(req('legacy.jwt.here'))).resolves.toBe(true);
  });
});
