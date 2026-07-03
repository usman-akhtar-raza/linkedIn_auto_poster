import { LinkedinOAuthService } from './linkedin-oauth.service';

describe('LinkedinOAuthService', () => {
  it('creates an authorization URL and stores only a hashed OAuth state', async () => {
    const prisma = {
      oAuthState: {
        create: jest.fn().mockResolvedValue({ id: 'state-1' }),
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          LINKEDIN_CLIENT_ID: 'client-id',
          LINKEDIN_REDIRECT_URI: 'http://localhost:4000/api/linkedin/oauth/callback',
          LINKEDIN_SCOPES: 'openid profile w_member_social',
        };
        return values[key];
      }),
    };
    const service = new LinkedinOAuthService(
      config as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.getAuthorizationUrl('user-1');
    const url = new URL(result.url);

    expect(url.hostname).toBe('www.linkedin.com');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(prisma.oAuthState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        stateHash: expect.not.stringContaining(url.searchParams.get('state') ?? ''),
      }),
    });
  });
});
