import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadsService } from '../uploads.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn(),
    __sendMock: sendMock,
  };
});

const { __sendMock: sendMock } = jest.requireMock<{
  __sendMock: jest.Mock;
}>('@aws-sdk/client-s3');

// Real magic bytes per declared mime — item 9 verifies content, not claims.
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ],
  'image/png': [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ],
  'image/webp': [
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ],
};

function bufferFor(mimetype: string, size: number): Buffer {
  const magic = Buffer.from(MAGIC_BYTES[mimetype] ?? []);
  if (magic.length === 0) {
    // No known magic: filler bytes that match nothing (e.g. HTML text).
    return Buffer.from('<html>'.repeat(Math.ceil(size / 6)));
  }
  const padding = Buffer.alloc(Math.max(0, size - magic.length), 0);
  return Buffer.concat([magic, padding]).subarray(
    0,
    Math.max(size, magic.length),
  );
}

const makeFile = (
  name: string,
  mimetype: string,
  size: number,
): Express.Multer.File =>
  ({
    fieldname: 'files',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size,
    buffer: bufferFor(mimetype, size),
  }) as Express.Multer.File;

const makeRawFile = (
  name: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File =>
  ({
    fieldname: 'files',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
  }) as Express.Multer.File;

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET = 'versale';
    sendMock.mockReset().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadsService],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFiles', () => {
    it('rejects empty list with a Spanish BadRequestException, not a 500', () => {
      expect(() => service.validateFiles([])).toThrow(BadRequestException);
      expect(() => service.validateFiles([])).toThrow(
        'No se proporcionaron archivos.',
      );
    });

    it('rejects more than 5 files with a Spanish BadRequestException, not a 500', () => {
      const files = Array.from({ length: 6 }, (_, i) =>
        makeFile(`a${i}.jpg`, 'image/jpeg', 1024),
      );
      expect(() => service.validateFiles(files)).toThrow(BadRequestException);
      expect(() => service.validateFiles(files)).toThrow(
        'Demasiados archivos. Máximo 5 por publicación.',
      );
    });

    it('rejects oversized file with a Spanish BadRequestException, not a 500', () => {
      const file = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
      expect(() => service.validateFiles([file])).toThrow(BadRequestException);
      expect(() => service.validateFiles([file])).toThrow(
        'El archivo «big.jpg» supera el límite de 5MB.',
      );
    });

    it('rejects unsupported mime type with a Spanish BadRequestException, not a 500', () => {
      const file = makeFile('doc.pdf', 'application/pdf', 1024);
      expect(() => service.validateFiles([file])).toThrow(BadRequestException);
      expect(() => service.validateFiles([file])).toThrow(
        'El archivo «doc.pdf» tiene un formato no permitido. Se aceptan: JPG, PNG, WEBP.',
      );
    });

    it('rejects a forged mime whose magic bytes say otherwise (item 9)', () => {
      const htmlAsPng = makeRawFile(
        'payload.png',
        'image/png',
        Buffer.from('<html><script>alert(1)</script></html>'),
      );
      expect(() => service.validateFiles([htmlAsPng])).toThrow(
        BadRequestException,
      );
      expect(() => service.validateFiles([htmlAsPng])).toThrow(
        /no corresponde a una imagen image\/png válida/,
      );
    });

    it('rejects a truncated file shorter than any magic signature', () => {
      const tiny = makeRawFile('tiny.png', 'image/png', Buffer.from([0x89]));
      expect(() => service.validateFiles([tiny])).toThrow(BadRequestException);
    });

    it('accepts real image bytes regardless of the filename', () => {
      const uglyName = makeRawFile(
        'payload.html',
        'image/png',
        bufferFor('image/png', 1024),
      );
      expect(() => service.validateFiles([uglyName])).not.toThrow();
    });

    it('derives the stored extension from the validated mime, not the filename (item 9)', async () => {
      const pngWithHtmlName = makeRawFile(
        'payload.html',
        'image/png',
        bufferFor('image/png', 1024),
      );
      await service.uploadImages([pngWithHtmlName]);

      expect(PutObjectCommand).toHaveBeenCalledTimes(1);
      const ctor = PutObjectCommand as unknown as {
        mock: { calls: Array<[{ Key: string }]> };
      };
      const command = ctor.mock.calls[0][0];
      expect(command.Key).toMatch(/^products\/.+\.png$/);
      expect(command.Key).not.toMatch(/\.html$/);
    });

    it('accepts a valid jpg', () => {
      const file = makeFile('ok.jpg', 'image/jpeg', 1024);
      expect(() => service.validateFiles([file])).not.toThrow();
    });
  });

  describe('uploadImages', () => {
    it('uploads files and returns urls', async () => {
      const files = [
        makeFile('a.jpg', 'image/jpeg', 1024),
        makeFile('b.png', 'image/png', 2048),
      ];
      const result = await service.uploadImages(files);

      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(PutObjectCommand).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      for (const item of result) {
        expect(item.url).toMatch(
          /^https:\/\/test-account\.r2\.cloudflarestorage\.com\/versale\/products\//,
        );
        expect(item.key).toMatch(/^products\/.+\.(jpg|png)$/);
      }
    });

    it('throws InternalServerErrorException when R2 send fails', async () => {
      sendMock.mockReset().mockRejectedValueOnce(new Error('boom'));
      const files = [makeFile('a.jpg', 'image/jpeg', 1024)];
      await expect(service.uploadImages(files)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
