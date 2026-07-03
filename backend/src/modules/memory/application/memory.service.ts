import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getWritingMemory(userId: string) {
    const memories = await this.prisma.agentMemory.findMany({
      where: { userId },
      orderBy: [{ weight: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    });

    if (memories.length === 0) {
      return 'No prior memory yet. Avoid duplicate ideas and favor clear, practical engineering lessons.';
    }

    return memories
      .map(
        (memory) =>
          `${memory.type}:${memory.key}=${JSON.stringify(memory.value)}`,
      )
      .join('\n');
  }

  remember(
    userId: string,
    data: { type: string; key: string; value: unknown; weight?: number },
  ) {
    return this.prisma.agentMemory.upsert({
      where: { userId_type_key: { userId, type: data.type, key: data.key } },
      create: {
        userId,
        type: data.type,
        key: data.key,
        value: data.value as object,
        weight: data.weight ?? 1,
      },
      update: { value: data.value as object, weight: data.weight ?? 1 },
    });
  }
}
