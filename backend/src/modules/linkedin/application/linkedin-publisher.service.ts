import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { LinkedinOAuthService } from './linkedin-oauth.service';
import {
  LinkedInPermissionException,
  LinkedInTokenRevokedException,
} from '../domain/linkedin.errors';

@Injectable()
export class LinkedinPublisherService {
  private readonly logger = new Logger(LinkedinPublisherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly oauth: LinkedinOAuthService,
  ) {}

  async publishTextPost(
    userId: string,
    content: string,
  ): Promise<{ linkedinPostUrn: string }> {
    const account = await this.prisma.linkedInAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      this.logger.warn(
        `User ${userId} tried to publish without a LinkedIn account.`,
      );
      throw new PreconditionFailedException(
        'Connect LinkedIn before publishing.',
      );
    }

    const accessToken = await this.oauth.getValidAccessToken(userId);
    const author = account.memberUrn ?? `urn:li:person:${account.linkedinUserId}`;
    const body = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const response = await this.publishWithRetry(userId, accessToken, body);

    const data = response.data as { id?: string };
    const headers = response.headers as Record<
      string,
      string | string[] | undefined
    >;
    const restliId = headers['x-restli-id'];
    const normalizedRestliId = Array.isArray(restliId) ? restliId[0] : restliId;

    return {
      linkedinPostUrn: normalizedRestliId ?? data.id ?? '',
    };
  }

  async fetchMemberPosts(
    userId: string,
    limit = 50,
  ): Promise<
    Array<{ urn: string; text: string; createdAt: Date | null }>
  > {
    const account = await this.prisma.linkedInAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new PreconditionFailedException(
        'Connect LinkedIn before importing posts.',
      );
    }

    const accessToken = await this.oauth.getValidAccessToken(userId);
    const author = account.memberUrn ?? `urn:li:person:${account.linkedinUserId}`;
    const url = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(author)})&sortBy=CREATED&count=${limit}`;

    let response;
    try {
      response = await firstValueFrom(
        this.http.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }),
      );
    } catch (error) {
      const status = (error as AxiosError | undefined)?.response?.status;
      if (status === 401) {
        await this.oauth.markRevoked(userId);
        throw new LinkedInTokenRevokedException();
      }
      // 403 here almost always means the token lacks the r_member_social
      // read scope (the app is approved for w_member_social only).
      if (status === 403) {
        await this.oauth.markPermissionError(userId);
        throw new LinkedInPermissionException();
      }
      this.logger.error(
        `LinkedIn member-posts fetch failed: ${this.safeError(error)}`,
      );
      throw new PreconditionFailedException('LinkedIn post import failed.');
    }

    const data = response.data as {
      elements?: Array<{
        id?: string;
        created?: { time?: number };
        specificContent?: {
          'com.linkedin.ugc.ShareContent'?: {
            shareCommentary?: { text?: string };
          };
        };
      }>;
    };

    return (data.elements ?? [])
      .map((element) => ({
        urn: element.id ?? '',
        text:
          element.specificContent?.['com.linkedin.ugc.ShareContent']
            ?.shareCommentary?.text ?? '',
        createdAt: element.created?.time
          ? new Date(element.created.time)
          : null,
      }))
      .filter((post) => post.urn && post.text);
  }

  // Deletes the member's own post on LinkedIn. Uses w_member_social (the same
  // scope publishing needs). A 404 means it's already gone, which we treat as
  // success so the local row can still be removed.
  async deleteMemberPost(userId: string, urn: string): Promise<void> {
    const account = await this.prisma.linkedInAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new PreconditionFailedException(
        'Connect LinkedIn before deleting posts.',
      );
    }

    const accessToken = await this.oauth.getValidAccessToken(userId);
    const url = `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(urn)}`;

    try {
      await firstValueFrom(
        this.http.delete(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }),
      );
    } catch (error) {
      const status = (error as AxiosError | undefined)?.response?.status;
      if (status === 404) {
        return;
      }
      if (status === 401) {
        await this.oauth.markRevoked(userId);
        throw new LinkedInTokenRevokedException();
      }
      if (status === 403) {
        await this.oauth.markPermissionError(userId);
        throw new LinkedInPermissionException();
      }
      this.logger.error(
        `LinkedIn delete failed: ${this.safeError(error)}`,
      );
      throw new PreconditionFailedException('LinkedIn post deletion failed.');
    }
  }

  private async publishWithRetry(
    userId: string,
    accessToken: string,
    body: Record<string, unknown>,
  ) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await firstValueFrom(
          this.http.post('https://api.linkedin.com/v2/ugcPosts', body, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
          }),
        );
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError | undefined)?.response?.status;
        if (status === 401) {
          await this.oauth.markRevoked(userId);
          throw new LinkedInTokenRevokedException();
        }
        if (status === 403) {
          await this.oauth.markPermissionError(userId);
          throw new LinkedInPermissionException();
        }
        if (status && status < 500) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }

    this.logger.error(`LinkedIn publish failed after retries: ${this.safeError(lastError)}`);
    throw new PreconditionFailedException('LinkedIn publishing failed.');
  }

  private safeError(error: unknown) {
    const status = (error as AxiosError | undefined)?.response?.status;
    return status ? `status=${status}` : 'unknown_error';
  }
}
