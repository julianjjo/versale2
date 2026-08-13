import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// Derived from CreateProductDto rather than hand-copied. PartialType is a real
// runtime class (unlike a `Partial<T>` type annotation, which erases and would
// leave ValidationPipe with nothing to validate), so every constraint —
// including the `@IsNotEmpty` checks a hand-written clone silently dropped, and
// which let `{"title": ""}` blank a live listing — still applies to whichever
// fields the request actually sends.
export class UpdateProductDto extends PartialType(CreateProductDto) {}
