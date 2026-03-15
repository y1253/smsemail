import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteCcDto {
  @IsString()
  @IsNotEmpty({ message: 'cc_id is required' })
  cc_id!: string;
}
