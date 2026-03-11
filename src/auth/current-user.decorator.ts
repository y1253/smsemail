import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the decoded JWT payload (set on request.user by AuthGuard)
 * from the request object.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

