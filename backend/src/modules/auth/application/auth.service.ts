import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../../users/application/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async signUp(data: { email: string; password: string; name?: string }) {
    const existing = await this.users.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.users.create({
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
    });

    return this.issueToken(user.id, user.email);
  }

  async signIn(data: { email: string; password: string }) {
    const user = await this.users.findByEmail(data.email.toLowerCase());
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const matches = await bcrypt.compare(data.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.issueToken(user.id, user.email);
  }

  private issueToken(userId: string, email: string) {
    const accessToken = jwt.sign(
      { userId, email },
      this.config.getOrThrow<string>('JWT_SECRET'),
      { expiresIn: '7d' },
    );

    return {
      accessToken,
      user: { id: userId, email },
    };
  }
}
