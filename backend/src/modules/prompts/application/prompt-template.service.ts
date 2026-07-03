import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export const DEFAULT_SYSTEM_PROMPT =
  'You are an expert LinkedIn ghostwriter specializing in software engineering, SaaS startups, AI, and entrepreneurship.';

export const DEFAULT_USER_PROMPT = `Generate a LinkedIn post about:

{{topic}}

Target Audience:
{{targetAudience}}

Writing Style:
Professional
Educational
Storytelling
Human sounding
No AI clichés

Length:
250-400 words

End with an engaging question.`;

@Injectable()
export class PromptTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultTemplate(userId: string) {
    const template = await this.prisma.promptTemplate.findFirst({
      where: {
        OR: [
          { userId, isDefault: true },
          { userId: null, isDefault: true },
        ],
      },
      orderBy: { userId: 'desc' },
    });

    return (
      template ?? {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        userPrompt: DEFAULT_USER_PROMPT,
      }
    );
  }

  list(userId: string) {
    return this.prisma.promptTemplate.findMany({
      where: { OR: [{ userId }, { userId: null, isDefault: true }] },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  create(
    userId: string,
    data: {
      name: string;
      description?: string;
      systemPrompt: string;
      userPrompt: string;
    },
  ) {
    return this.prisma.promptTemplate.create({
      data: { ...data, userId },
    });
  }
}
