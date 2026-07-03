import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AuditService } from '../../../common/audit/audit.service';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  LinkedInPermissionException,
  LinkedInTokenRevokedException,
} from '../domain/linkedin.errors';

type LinkedInTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
};

type LinkedInProfile = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
};

type LinkedInOrganizationAclResponse = {
  elements?: Array<{
    organization?: string;
    role?: string;
    'organization~'?: {
      localizedName?: string;
    };
  }>;
};

@Injectable()
export class LinkedinOAuthService {
  private readonly logger = new Logger(LinkedinOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async getAuthorizationUrl(userId: string) {
    const clientId = this.config.get<string>('LINKEDIN_CLIENT_ID');
    const redirectUri = this.config.get<string>('LINKEDIN_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new UnauthorizedException('LinkedIn OAuth is not configured.');
    }

    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    await this.prisma.oAuthState.create({
      data: {
        userId,
        stateHash: this.hashState(state),
        nonce,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope:
        this.config.get<string>('LINKEDIN_SCOPES') ??
        'openid profile w_member_social',
    });

    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
    };
  }

  async handleCallback(input: { code?: string; state?: string; error?: string }) {
    if (input.error) {
      throw new BadRequestException(`LinkedIn OAuth failed: ${input.error}`);
    }

    if (!input.code || !input.state) {
      throw new BadRequestException('LinkedIn callback is missing code or state.');
    }

    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { stateHash: this.hashState(input.state) },
    });

    if (!oauthState || oauthState.usedAt || oauthState.expiresAt < new Date()) {
      throw new GoneException('LinkedIn OAuth state is expired or invalid.');
    }

    const token = await this.exchangeAuthorizationCode(input.code);
    const profile = await this.fetchProfile(token.access_token);
    const account = await this.saveConnection({
      userId: oauthState.userId,
      linkedinUserId: profile.sub,
      memberUrn: `urn:li:person:${profile.sub}`,
      vanityName: profile.name,
      localizedFirstName: profile.given_name,
      localizedLastName: profile.family_name,
      profilePictureUrl: profile.picture,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : undefined,
      scope: token.scope,
      profile,
    });

    await Promise.all([
      this.syncOrganizations(account.id, token.access_token),
      this.prisma.oAuthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      }),
      this.audit.record({
        userId: oauthState.userId,
        action: 'linkedin.connected',
        entity: 'LinkedInAccount',
        entityId: account.id,
        metadata: { scope: token.scope },
      }),
    ]);

    return this.getConnectionStatus(oauthState.userId);
  }

  async saveConnection(input: {
    userId: string;
    linkedinUserId: string;
    memberUrn?: string;
    vanityName?: string;
    localizedFirstName?: string;
    localizedLastName?: string;
    profilePictureUrl?: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    profile?: Record<string, unknown>;
  }) {
    return this.prisma.linkedInAccount.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        linkedinUserId: input.linkedinUserId,
        memberUrn: input.memberUrn,
        vanityName: input.vanityName,
        localizedFirstName: input.localizedFirstName,
        localizedLastName: input.localizedLastName,
        profilePictureUrl: input.profilePictureUrl,
        accessTokenCiphertext: this.encryption.encrypt(input.accessToken),
        refreshTokenCiphertext: input.refreshToken
          ? this.encryption.encrypt(input.refreshToken)
          : undefined,
        tokenKeyVersion: this.encryption.getCurrentKeyVersion(),
        expiresAt: input.expiresAt,
        scope: input.scope,
        profile: (input.profile ?? {}) as Prisma.InputJsonValue,
        connectionStatus: 'CONNECTED',
      },
      update: {
        linkedinUserId: input.linkedinUserId,
        memberUrn: input.memberUrn,
        vanityName: input.vanityName,
        localizedFirstName: input.localizedFirstName,
        localizedLastName: input.localizedLastName,
        profilePictureUrl: input.profilePictureUrl,
        accessTokenCiphertext: this.encryption.encrypt(input.accessToken),
        refreshTokenCiphertext: input.refreshToken
          ? this.encryption.encrypt(input.refreshToken)
          : undefined,
        tokenKeyVersion: this.encryption.getCurrentKeyVersion(),
        expiresAt: input.expiresAt,
        scope: input.scope,
        profile: (input.profile ?? {}) as Prisma.InputJsonValue,
        connectionStatus: 'CONNECTED',
        disconnectedAt: null,
        lastRefreshedAt: new Date(),
      },
    });
  }

  async getConnectionStatus(userId: string) {
    const account = await this.prisma.linkedInAccount.findUnique({
      where: { userId },
      include: { organizations: true },
    });

    if (!account) {
      return { connected: false, status: 'DISCONNECTED', organizations: [] };
    }

    return {
      connected: account.connectionStatus === 'CONNECTED',
      status: account.connectionStatus,
      linkedinUserId: account.linkedinUserId,
      memberUrn: account.memberUrn,
      vanityName: account.vanityName,
      localizedFirstName: account.localizedFirstName,
      localizedLastName: account.localizedLastName,
      profilePictureUrl: account.profilePictureUrl,
      expiresAt: account.expiresAt,
      scope: account.scope,
      organizations: account.organizations.map((organization) => ({
        organizationId: organization.organizationId,
        organizationUrn: organization.organizationUrn,
        localizedName: organization.localizedName,
        role: organization.role,
      })),
    };
  }

  async disconnect(userId: string) {
    const account = await this.prisma.linkedInAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return this.getConnectionStatus(userId);
    }

    await this.prisma.linkedInAccount.update({
      where: { userId },
      data: {
        connectionStatus: 'DISCONNECTED',
        disconnectedAt: new Date(),
      },
    });
    await this.audit.record({
      userId,
      action: 'linkedin.disconnected',
      entity: 'LinkedInAccount',
      entityId: account.id,
    });

    return this.getConnectionStatus(userId);
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const account = await this.prisma.linkedInAccount.findUnique({
      where: { userId },
    });

    if (!account || account.connectionStatus !== 'CONNECTED') {
      throw new LinkedInTokenRevokedException();
    }

    if (!account.expiresAt || account.expiresAt.getTime() > Date.now() + 60_000) {
      return this.encryption.decrypt(account.accessTokenCiphertext);
    }

    if (!account.refreshTokenCiphertext) {
      await this.markExpired(userId);
      throw new LinkedInTokenRevokedException();
    }

    const refreshToken = this.encryption.decrypt(account.refreshTokenCiphertext);
    const token = await this.refreshAccessToken(refreshToken);
    await this.saveConnection({
      userId,
      linkedinUserId: account.linkedinUserId,
      memberUrn: account.memberUrn ?? undefined,
      vanityName: account.vanityName ?? undefined,
      localizedFirstName: account.localizedFirstName ?? undefined,
      localizedLastName: account.localizedLastName ?? undefined,
      profilePictureUrl: account.profilePictureUrl ?? undefined,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : account.expiresAt,
      scope: token.scope ?? account.scope ?? undefined,
      profile: account.profile as Record<string, unknown>,
    });

    return token.access_token;
  }

  async markPermissionError(userId: string) {
    await this.prisma.linkedInAccount.update({
      where: { userId },
      data: {
        connectionStatus: 'PERMISSION_ERROR',
        lastPermissionErrorAt: new Date(),
      },
    });
  }

  async markRevoked(userId: string) {
    await this.prisma.linkedInAccount.update({
      where: { userId },
      data: { connectionStatus: 'REVOKED' },
    });
  }

  private async markExpired(userId: string) {
    await this.prisma.linkedInAccount.update({
      where: { userId },
      data: { connectionStatus: 'EXPIRED' },
    });
  }

  private async exchangeAuthorizationCode(code: string) {
    return this.postTokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.getOrThrow<string>('LINKEDIN_REDIRECT_URI'),
    });
  }

  private async refreshAccessToken(refreshToken: string) {
    return this.postTokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async postTokenRequest(body: Record<string, string>) {
    const response = await this.withRetry(() =>
      firstValueFrom(
        this.http.post<LinkedInTokenResponse>(
          'https://www.linkedin.com/oauth/v2/accessToken',
          new URLSearchParams({
            ...body,
            client_id: this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
            client_secret: this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      ),
    );

    return response.data;
  }

  private async fetchProfile(accessToken: string) {
    const response = await this.withRetry(() =>
      firstValueFrom(
        this.http.get<LinkedInProfile>('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ),
    );

    return response.data;
  }

  private async syncOrganizations(accountId: string, accessToken: string) {
    try {
      const response = await this.withRetry(() =>
        firstValueFrom(
          this.http.get<LinkedInOrganizationAclResponse>(
            'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&state=APPROVED&projection=(elements*(organization,role,organization~(localizedName)))',
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        ),
      );

      const elements = response.data.elements ?? [];
      await Promise.all(
        elements
          .filter((element) => element.organization)
          .map((element) => {
            const organizationUrn = element.organization as string;
            const organizationId = organizationUrn.split(':').at(-1) ?? organizationUrn;
            return this.prisma.linkedInOrganization.upsert({
              where: { accountId_organizationId: { accountId, organizationId } },
              create: {
                accountId,
                organizationId,
                organizationUrn,
                localizedName: element['organization~']?.localizedName,
                role: element.role,
                raw: element as Prisma.InputJsonValue,
              },
              update: {
                organizationUrn,
                localizedName: element['organization~']?.localizedName,
                role: element.role,
                raw: element as Prisma.InputJsonValue,
              },
            });
          }),
      );
    } catch (error) {
      this.logger.warn(`LinkedIn organization sync failed: ${this.safeError(error)}`);
    }
  }

  private hashState(state: string) {
    return createHash('sha256').update(state).digest('hex');
  }

  private async withRetry<T>(operation: () => Promise<AxiosResponse<T>>) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const status = this.statusFromError(error);
        if (status === 401) {
          throw new LinkedInTokenRevokedException();
        }
        if (status === 403) {
          throw new LinkedInPermissionException();
        }
        if (status && status < 500) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    throw new ServiceUnavailableException(
      `LinkedIn request failed: ${this.safeError(lastError)}`,
    );
  }

  private statusFromError(error: unknown) {
    return (error as AxiosError | undefined)?.response?.status;
  }

  private safeError(error: unknown) {
    const status = this.statusFromError(error);
    return status ? `status=${status}` : 'unknown_error';
  }
}
