import { Transform } from 'class-transformer';

// Runs before class-validator's checks (the global ValidationPipe has
// transform:true), so a whitespace-only value is already '' by the time
// @IsNotEmpty/@MaxLength see it.
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
