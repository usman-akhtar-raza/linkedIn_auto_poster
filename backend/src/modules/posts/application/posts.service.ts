import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WriterService } from '../../ai/application/writer.service';
import { EditorService } from '../../ai/application/editor.service';
import { ImagePromptService } from '../../ai/application/image-prompt.service';
import { LinkedinPublisherService } from '../../linkedin/application/linkedin-publisher.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: WriterService,
    private readonly editor: EditorService,
    private readonly imagePrompts: ImagePromptService,
    private readonly publisher: LinkedinPublisherService,
  ) {}

  list(userId: string) {
    return this.listPaginated(userId, {});
  }

  async listPaginated(
    userId: string,
    filters: { page?: number; pageSize?: number; search?: string; status?: string },
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = {
      userId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' as const } },
              { hook: { contains: filters.search, mode: 'insensitive' as const } },
              { content: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { analytics: true, generatedImages: true, topic: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async generateDraft(
    userId: string,
    data: { topic: string; includeImage?: boolean },
  ) {
    const draft = await this.writer.generatePost({ userId, topic: data.topic });
    const content = await this.editor.polish(draft);
    const hook = content.split('\n').find(Boolean)?.slice(0, 180) ?? data.topic;

    const post = await this.prisma.post.create({
      data: {
        userId,
        title: data.topic,
        hook,
        content,
        hashtags: ['AI', 'SaaS', 'SoftwareEngineering'],
        status: 'PENDING_APPROVAL',
      },
    });

    if (data.includeImage) {
      const prompt = await this.imagePrompts.createPrompt(data.topic, content);
      await this.prisma.generatedImage.create({
        data: { postId: post.id, prompt, provider: 'pending-provider' },
      });
    }

    return this.getOwnedPost(userId, post.id);
  }

  async approve(userId: string, postId: string) {
    await this.ensureOwned(userId, postId);
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });
  }

  async reject(userId: string, postId: string, reason?: string) {
    await this.ensureOwned(userId, postId);
    return this.prisma.post.update({
      where: { id: postId },
      data: { status: 'REJECTED', rejectionReason: reason },
    });
  }

  async publish(userId: string, postId: string) {
    const post = await this.getOwnedPost(userId, postId);
    const published = await this.publisher.publishTextPost(
      userId,
      post.content,
    );

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        linkedinPostUrn: published.linkedinPostUrn,
      },
    });
  }

  private async ensureOwned(userId: string, postId: string) {
    await this.getOwnedPost(userId, postId);
  }

  private async getOwnedPost(userId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
      include: { analytics: true, generatedImages: true, topic: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }
}
