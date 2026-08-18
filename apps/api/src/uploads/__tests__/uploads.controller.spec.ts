import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadsController } from '../uploads.controller';
import { UploadsService } from '../uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;

  const mockService = {
    uploadImages: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: mockService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns uploaded image metadata from the service', async () => {
    const files = [
      {
        fieldname: 'files',
        originalname: 'a.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('x'),
      } as Express.Multer.File,
    ];
    const serviceResult = [
      { key: 'products/abc.jpg', url: 'https://example.com/products/abc.jpg' },
    ];
    mockService.uploadImages.mockResolvedValue(serviceResult);

    const result = await controller.uploadImages(files);

    expect(mockService.uploadImages).toHaveBeenCalledWith(files);
    expect(result).toEqual({ images: serviceResult });
  });

  describe('fileFilter', () => {
    const cb = jest.fn();

    beforeEach(() => cb.mockReset());

    it('rejects unsupported mimetype', () => {
      UploadsController.fileFilter(
        null,
        {
          mimetype: 'application/pdf',
        } as Express.Multer.File,
        cb,
      );
      expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });

    it('accepts supported mimetype', () => {
      UploadsController.fileFilter(
        null,
        { mimetype: 'image/jpeg' } as Express.Multer.File,
        cb,
      );
      expect(cb).toHaveBeenCalledWith(null, true);
    });
  });
});
