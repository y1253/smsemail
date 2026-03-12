import { IsNotEmpty, IsString } from 'class-validator';

export class AttachPaymentMethodDto {
  @IsString()
  @IsNotEmpty({ message: 'paymentMethodId is required' })
  paymentMethodId!: string;
}
