import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { sanitizeImageUrl } from '../../../common/security/safe-url';
import { OpenRouterClient } from '../../ai/infrastructure/openrouter.client';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterClient,
  ) {}

  createPending(postId: string, prompt: string) {
    return this.prisma.generatedImage.create({
      data: { postId, prompt, provider: 'openrouter', status: 'PENDING' },
    });
  }

  async generate(imageId: string) {
    const image = await this.prisma.generatedImage.findUnique({
      where: { id: imageId },
    });
    if (!image || image.status === 'COMPLETED') {
      return image;
    }

    try {
      const rawUrl = await this.openRouter.generateImage(image.prompt);
      const imageUrl = sanitizeImageUrl(rawUrl);
      if (!imageUrl) {
        // Model returned a non-https / non-data:image URL — reject rather than
        // persist a potential javascript:/data:text/html XSS payload.
        throw new Error('Generated image URL has an unsupported scheme.');
      }
      return await this.prisma.generatedImage.update({
        where: { id: imageId },
        data: { imageUrl, status: 'COMPLETED' },
      });
    } catch (error) {
      this.logger.error(
        `Image generation failed imageId=${imageId}: ${(error as Error).message}`,
      );
      await this.prisma.generatedImage.update({
        where: { id: imageId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async generateForPost(postId: string, prompt: string) {
    const pending = await this.createPending(postId, prompt);
    return this.generate(pending.id);
  }
}
