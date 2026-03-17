import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateSetDto {
  @IsInt()
  @IsNotEmpty()
  phoneId!: number;

  @IsInt()
  @IsNotEmpty()
  emailId!: number;
}

