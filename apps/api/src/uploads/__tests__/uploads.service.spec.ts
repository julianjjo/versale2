import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { UploadsService } from '../uploads.service';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn(),
    __sendMock: sendMock,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/client-s3') as {
  __sendMock: jest.Mock;
};

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
    buffer: Buffer.from('test'),
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
    it('rejects empty list', () => {
      expect(() => service.validateFiles([])).toThrow(
        InternalServerErrorException,
      );
    });

    it('rejects more than 5 files', () => {
      const files = Array.from({ length: 6 }, (_, i) =>
        makeFile(`a${i}.jpg`, 'image/jpeg', 1024),
      );
      expect(() => service.validateFiles(files)).toThrow(
        InternalServerErrorException,
      );
    });

    it('rejects oversized file', () => {
      const file = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
      expect(() => service.validateFiles([file])).toThrow(
        InternalServerErrorException,
      );
    });

    it('rejects unsupported mime type', () => {
      const file = makeFile('doc.pdf', 'application/pdf', 1024);
      expect(() => service.validateFiles([file])).toThrow(
        InternalServerErrorException,
      );
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
