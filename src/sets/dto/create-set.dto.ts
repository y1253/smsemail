import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSetDto {
  @IsInt()
  @IsNotEmpty()
  phoneId!: number;

  @IsInt()
  @IsNotEmpty()
  emailId!: number;

  @IsOptional()
  @IsString()
  promoCode?: string;
}

