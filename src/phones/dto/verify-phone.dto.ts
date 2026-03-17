import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Phone should be at least 10 digits' })
  @MaxLength(45)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Code must be 6 digits' })
  @MaxLength(10)
  code!: string;
}
