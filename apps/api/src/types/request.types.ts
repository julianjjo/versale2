import { Request } from 'express';
import { JwtPayload } from './jwt.types';

export interface AuthRequest extends Request {
  user: JwtPayload;
}