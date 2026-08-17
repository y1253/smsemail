import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(145)
  first_name!: string;

  @IsString()
  @MaxLength(145)
  @IsOptional()
  last_name?: string;

  @IsEmail()
  email!: string;

  // ASVS L1: min 12 chars, allow long passphrases (>= 64). bcrypt truncates at
  // 72 bytes, so cap there rather than at 45.
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(72)
  password!: string;

  @IsString()
  @MaxLength(45)
  @IsOptional()
  auth_type?: string;
}
