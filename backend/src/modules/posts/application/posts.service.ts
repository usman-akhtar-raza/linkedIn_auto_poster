import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WriterService } from '../../ai/application/writer.service';
import { EditorService } from '../../ai/application/editor.service';
import { ImagePromptService } from '../../ai/application/image-prompt.service';
import { ImagesService } from '../../images/application/images.service';
import { LinkedinPublisherService } from '../../linkedin/application/linkedin-publisher.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: WriterService,
    private readonly editor: EditorService,
    private readonly imagePrompts: ImagePromptService,
    private readonly images: ImagesService,
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
      const pending = await this.images.createPending(post.id, prompt);
      void this.images.generate(pending.id).catch(() => undefined);
    }

    return this.getOwnedPost(userId, post.id);
  }

  async create(
    userId: string,
    data: {
      title: string;
      hook?: string;
      content: string;
      hashtags?: string[];
      topicId?: string;
    },
  ) {
    if (data.topicId) {
      await this.ensureTopicUsable(userId, data.topicId);
    }

    const hook =
      data.hook ?? data.content.split('\n').find(Boolean)?.slice(0, 180) ?? data.title;

    // A manually created post publishes straight to LinkedIn. Publish first so
    // the whole operation is atomic — if LinkedIn publishing fails (e.g. not
    // connected) nothing is stored and the caller gets the error.
    const published = await this.publisher.publishTextPost(userId, data.content);

    const post = await this.prisma.post.create({
      data: {
        userId,
        topicId: data.topicId,
        title: data.title,
        hook,
        content: data.content,
        hashtags: data.hashtags ?? [],
        status: 'PUBLISHED',
        publishedAt: new Date(),
        linkedinPostUrn: published.linkedinPostUrn,
      },
    });

    return this.getOwnedPost(userId, post.id);
  }

  get(userId: string, postId: string) {
    return this.getOwnedPost(userId, postId);
  }

  async update(
    userId: string,
    postId: string,
    data: {
      title?: string;
      hook?: string;
      content?: string;
      hashtags?: string[];
    },
  ) {
    const post = await this.getOwnedPost(userId, postId);

    if (post.status === 'PUBLISHED') {
      throw new PreconditionFailedException(
        'Published posts cannot be edited; the content is already live on LinkedIn.',
      );
    }

    const editsContent =
      data.title !== undefined ||
      data.hook !== undefined ||
      data.content !== undefined ||
      data.hashtags !== undefined;

    // Editing content invalidates a prior review decision — send it back
    // through the approval gate so the change is re-reviewed before publishing.
    const resetApproval =
      editsContent &&
      (post.status === 'APPROVED' ||
        post.status === 'SCHEDULED' ||
        post.status === 'REJECTED');

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.hook !== undefined ? { hook: data.hook } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.hashtags !== undefined ? { hashtags: data.hashtags } : {}),
        ...(resetApproval
          ? {
              status: 'PENDING_APPROVAL',
              approvedAt: null,
              scheduledFor: null,
              rejectionReason: null,
            }
          : {}),
      },
    });

    return this.getOwnedPost(userId, postId);
  }

  async remove(userId: string, postId: string) {
    const post = await this.getOwnedPost(userId, postId);

    // If the post is live on LinkedIn, delete it there first. If that fails the
    // exception propagates and the local row is kept, so the app never claims a
    // still-published post was removed.
    if (post.linkedinPostUrn) {
      await this.publisher.deleteMemberPost(userId, post.linkedinPostUrn);
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { id: postId, deleted: true };
  }

  // Pulls the user's existing LinkedIn posts and stores any that aren't already
  // in the DB as PUBLISHED rows, so history from before they connected shows up
  // in the list. Requires the LinkedIn token to hold the r_member_social scope.
  async importFromLinkedIn(userId: string) {
    const remote = await this.publisher.fetchMemberPosts(userId);

    const existing = await this.prisma.post.findMany({
      where: { userId, linkedinPostUrn: { in: remote.map((post) => post.urn) } },
      select: { linkedinPostUrn: true },
    });
    const known = new Set(existing.map((post) => post.linkedinPostUrn));

    const toImport = remote.filter((post) => !known.has(post.urn));

    if (toImport.length > 0) {
      await this.prisma.post.createMany({
        data: toImport.map((post) => ({
          userId,
          title: post.text.split('\n').find(Boolean)?.slice(0, 120) ?? 'LinkedIn post',
          hook: post.text.split('\n').find(Boolean)?.slice(0, 180) ?? '',
          content: post.text,
          hashtags: [],
          status: 'PUBLISHED' as const,
          publishedAt: post.createdAt ?? new Date(),
          linkedinPostUrn: post.urn,
        })),
      });
    }

    return {
      fetched: remote.length,
      imported: toImport.length,
      skipped: remote.length - toImport.length,
    };
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
    if (post.status !== 'APPROVED' && post.status !== 'SCHEDULED') {
      throw new PreconditionFailedException(
        'Only approved or scheduled posts can be published.',
      );
    }

    const published = await this.publisher.publishTextPost(
      userId,
      post.content,
    );

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        scheduledFor: null,
        linkedinPostUrn: published.linkedinPostUrn,
      },
    });
  }

  async schedule(userId: string, postId: string, scheduledFor: Date) {
    const post = await this.getOwnedPost(userId, postId);
    if (post.status !== 'APPROVED' && post.status !== 'SCHEDULED') {
      throw new PreconditionFailedException(
        'Only approved posts can be scheduled.',
      );
    }

    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Schedule time is invalid.');
    }

    if (scheduledFor.getTime() <= Date.now()) {
      throw new BadRequestException('Schedule time must be in the future.');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'SCHEDULED',
        scheduledFor,
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

  private async ensureTopicUsable(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, OR: [{ userId }, { userId: null }] },
      select: { id: true },
    });

    if (!topic) {
      throw new BadRequestException('Topic not found.');
    }
  }
}
