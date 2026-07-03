import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    userId: string,
    data: {
      type:
        | 'RESEARCH'
        | 'GENERATE_POST'
        | 'GENERATE_IMAGE'
        | 'PUBLISH_POST'
        | 'ANALYTICS';
      payload?: object;
    },
  ) {
    return this.prisma.job.create({
      data: { userId, type: data.type, payload: data.payload ?? {} },
    });
  }
}
