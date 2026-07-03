import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export class LinkedInTokenRevokedException extends UnauthorizedException {
  constructor() {
    super('LinkedIn token is revoked or invalid. Reconnect LinkedIn.');
  }
}

export class LinkedInPermissionException extends ForbiddenException {
  constructor() {
    super('LinkedIn permissions are insufficient. Reconnect with the required scopes.');
  }
}
