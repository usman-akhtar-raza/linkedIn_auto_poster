import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { linkedinAccount: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      aiPreferences: user.aiPreferences,
      scheduleFrequency: user.scheduleFrequency,
      scheduleCron: user.scheduleCron,
      scheduleDates: user.scheduleDates,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      linkedinConnected: Boolean(user.linkedinAccount),
    };
  }

  create(data: { email: string; name?: string; passwordHash?: string }) {
    return this.prisma.user.create({ data });
  }

  updatePreferences(
    userId: string,
    data: { aiPreferences?: object; timezone?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
