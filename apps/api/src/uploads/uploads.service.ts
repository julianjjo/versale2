import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { sniffImageMime } from './magic-bytes';

export interface UploadedFileResult {
  url: string;
  key: string;
}

const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_COUNT = 5;

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private client!: S3Client;
  private bucket!: string;
  private publicBaseUrl!: string;

  onModuleInit() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    const publicBaseUrl =
      process.env.R2_PUBLIC_BASE_URL ??
      (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
        : undefined);

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      this.logger.warn(
        'R2 credentials missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET). Uploads will fail until configured.',
      );
    }

    this.bucket = bucket ?? '';
    this.publicBaseUrl = publicBaseUrl ?? '';
    this.client = new S3Client({
      region: 'auto',
      endpoint: accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : undefined,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  validateFiles(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron archivos.');
    }
    if (files.length > MAX_FILE_COUNT) {
      throw new BadRequestException(
        `Demasiados archivos. Máximo ${MAX_FILE_COUNT} por publicación.`,
      );
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `El archivo «${file.originalname}» supera el límite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        );
      }
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          `El archivo «${file.originalname}» tiene un formato no permitido. Se aceptan: JPG, PNG, WEBP.`,
        );
      }
      // Item 9: the declared Content-Type is client-controlled. Verify the
      // actual bytes — a forged mimetype (e.g. HTML declaring image/png)
      // would otherwise land in the bucket and be served to buyers.
      const sniffed = sniffImageMime(file.buffer);
      if (sniffed === null || sniffed !== file.mimetype) {
        throw new BadRequestException(
          `El contenido de «${file.originalname}» no corresponde a una imagen ${file.mimetype} válida.`,
        );
      }
    }
  }

  async uploadImages(
    files: Express.Multer.File[],
  ): Promise<UploadedFileResult[]> {
    this.validateFiles(files);
    return Promise.all(files.map((file) => this.uploadOne(file)));
  }

  private async uploadOne(
    file: Express.Multer.File,
  ): Promise<UploadedFileResult> {
    // Item 9: the extension is derived from the VALIDATED mime (the bytes
    // were proven to match it), never from the client-controlled filename —
    // 'payload.html' claiming image/png gets stored as .png with png bytes.
    const ext = this.mimeToExt(file.mimetype);
    const key = `products/${randomUUID()}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to upload ${key} to R2`, err as Error);
      throw new InternalServerErrorException(
        'Failed to upload image to storage',
      );
    }

    return {
      key,
      url: `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`,
    };
  }

  private mimeToExt(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '';
    }
  }
}
