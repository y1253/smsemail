import { IsArray, IsEmail, IsOptional } from 'class-validator';

export class UpdateSendersDto {
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  senders: string[] = [];
}
