import { Global, Module } from '@nestjs/common';
import { SignalwireService } from './signalwire.service';

@Global()
@Module({
  providers: [SignalwireService],
  exports: [SignalwireService],
})
export class SignalwireModule {}
