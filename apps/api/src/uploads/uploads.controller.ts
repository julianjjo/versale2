import {
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService, UploadedFileResult } from './uploads.service';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function imageFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (err: Error | null, ok: boolean) => void,
) {
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        `Unsupported file type. Allowed: JPG, PNG, WEBP.`,
      ),
      false,
    );
  }
  cb(null, true);
}

@Controller('uploads')
export class UploadsController {
  static readonly fileFilter = imageFileFilter;

  constructor(private readonly uploadsService: UploadsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('images')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ images: UploadedFileResult[] }> {
    const images = await this.uploadsService.uploadImages(files ?? []);
    return { images };
  }
}
