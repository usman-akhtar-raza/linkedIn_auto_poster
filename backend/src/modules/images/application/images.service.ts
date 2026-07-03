import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ImagesService {
  constructor(private readonly prisma: PrismaService) {}

  createPending(postId: string, prompt: string) {
    return this.prisma.generatedImage.create({
      data: { postId, prompt, provider: 'pending-provider', status: 'PENDING' },
    });
  }
}
