import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  PayloadTooLargeException,
  Post,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService, UploadedFileResult } from './uploads.service';

@Catch(multer.MulterError)
export class MulterLimitFilter implements ExceptionFilter {
  catch(exception: multer.MulterError, _host: ArgumentsHost) {
    if ((exception as multer.MulterError).code === 'LIMIT_FILE_SIZE')
      throw new PayloadTooLargeException('La imagen supera 5MB.');
    throw exception;
  }
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('images')
  @UseFilters(MulterLimitFilter)
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ images: UploadedFileResult[] }> {
    const images = await this.uploadsService.uploadImages(files ?? []);
    return { images };
  }
}
