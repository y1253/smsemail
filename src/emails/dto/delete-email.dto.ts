import { IsInt, IsNotEmpty } from 'class-validator';

export class DeleteEmailDto {
  @IsInt()
  @IsNotEmpty()
  emailId!: number;
}
