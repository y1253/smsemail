import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AddPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Phone should be at least 10 digits' })
  @MaxLength(45)
  phone!: string;
}
