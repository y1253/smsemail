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

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(45)
  password!: string;

  @IsString()
  @MaxLength(45)
  @IsOptional()
  auth_type?: string;
}
