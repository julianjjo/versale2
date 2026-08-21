import { Global, Module } from '@nestjs/common';
import { BrevoService } from './brevo.service';

// Módulo separado del NotificationsModule (notificaciones in-app de la campana):
// este solo expone el transporte de email transaccional vía Brevo.
@Global()
@Module({
  providers: [BrevoService],
  exports: [BrevoService],
})
export class BrevoModule {}
