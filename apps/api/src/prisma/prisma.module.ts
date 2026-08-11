import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so every feature module shares this one PrismaService instance -
// and therefore one underlying better-sqlite3 connection - instead of each
// declaring its own. With a single shared connection, Prisma serializes
// competing operations (e.g. an interactive $transaction in OrdersService
// vs. a plain write in CartService) on the same client, which is what
// actually closes races between checkout and concurrent cart mutations.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
