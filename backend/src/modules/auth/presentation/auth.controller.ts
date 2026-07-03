import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Post('signin')
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto);
  }
}
