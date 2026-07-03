import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../../database/prisma.service';
import { LinkedinOAuthService } from '../../linkedin/application/linkedin-oauth.service';

type LinkedInSocialActions = {
  likesSummary?: { totalLikes?: number };
  commentsSummary?: { aggregatedTotalComments?: number };
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly linkedin: LinkedinOAuthService,
  ) {}

  async save(
    postId: string,
    data: {
      likes?: number;
      comments?: number;
      impressions?: number;
      shares?: number;
      clicks?: number;
      followerGrowth?: number;
    },
  ) {
    const impressions = data.impressions ?? 0;
    const clicks = data.clicks ?? 0;
    const engagement =
      (data.likes ?? 0) + (data.comments ?? 0) + (data.shares ?? 0);

    return this.prisma.postAnalytics.upsert({
      where: { postId },
      create: {
        postId,
        ...data,
        ctr: impressions > 0 ? clicks / impressions : 0,
        engagementRate: impressions > 0 ? engagement / impressions : 0,
      },
      update: {
        ...data,
        ctr: impressions > 0 ? clicks / impressions : 0,
        engagementRate: impressions > 0 ? engagement / impressions : 0,
        collectedAt: new Date(),
      },
    });
  }

  summary(userId: string) {
    return this.prisma.post.findMany({
      where: { userId, status: 'PUBLISHED' },
      include: { analytics: true },
      orderBy: { publishedAt: 'desc' },
      take: 30,
    });
  }

  async collectFromLinkedIn(userId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
      include: { analytics: true },
    });

    if (!post?.linkedinPostUrn) {
      return null;
    }

    const accessToken = await this.linkedin.getValidAccessToken(userId);
    const response = await firstValueFrom(
      this.http.get<LinkedInSocialActions>(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedinPostUrn)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      ),
    );

    return this.save(postId, {
      likes: response.data.likesSummary?.totalLikes ?? post.analytics?.likes ?? 0,
      comments:
        response.data.commentsSummary?.aggregatedTotalComments ??
        post.analytics?.comments ??
        0,
      impressions: post.analytics?.impressions ?? 0,
      shares: post.analytics?.shares ?? 0,
      clicks: post.analytics?.clicks ?? 0,
      followerGrowth: post.analytics?.followerGrowth ?? 0,
    });
  }
}
