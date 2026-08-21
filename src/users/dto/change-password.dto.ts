import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Current password is required' })
  @MaxLength(72)
  current_password!: string;

  // Same policy as registration (see CreateUserDto): ASVS L1 min 12 chars,
  // capped at 72 bytes because bcrypt truncates there.
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(72)
  new_password!: string;
}
