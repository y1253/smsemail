import { IsInt, IsNotEmpty } from 'class-validator';

export class DeletePhoneDto {
  @IsInt()
  @IsNotEmpty()
  phoneId!: number;
}
