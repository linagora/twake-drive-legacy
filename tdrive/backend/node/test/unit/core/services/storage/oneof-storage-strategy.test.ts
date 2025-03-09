import { Readable, PassThrough } from 'stream';
import { OneOfStorageStrategy } from "../../../../../src/core/platform/services/storage/oneof-storage-strategy"; // Adjust the import path as necessary
import {StorageConnectorAPI } from "../../../../../src/core/platform/services/storage/provider"; // Adjust the import path as necessary

function mockStream() {
  const stream = new Readable();
  stream.push("Test data");
  stream.push(null);
  return stream;
}

function mockStorage(size: number) {
  return {
    write: jest.fn().mockResolvedValue({ size: size }),
    read: jest.fn(),
    exists: jest.fn(),
    remove: jest.fn().mockResolvedValue(true),
    getId: jest.fn().mockResolvedValue("Mock Storage ID")
  } as unknown as StorageConnectorAPI;
}

describe('OneOfStorageStrategy', () => {
  let storage1: StorageConnectorAPI;
  let storage2: StorageConnectorAPI;
  let storage3: StorageConnectorAPI;
  let oneOfStorageStrategy: OneOfStorageStrategy;

  beforeEach(() => {
    // Mocking two storage backends
    storage1 = mockStorage(100);
    storage2 =  mockStorage(200);
    storage3 =  mockStorage(300);

    oneOfStorageStrategy = new OneOfStorageStrategy([storage1, storage2, storage3]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('write', () => {
    it('should write to all configured storages', async () => {
      const path = 'test/path';
      const stream = mockStream();

      const result = await oneOfStorageStrategy.write(path, stream);

      expect(storage1.write).toHaveBeenCalled();
      expect(storage2.write).toHaveBeenCalled();
      expect(result.size).toBe(100); // Assuming the first storage returned this size
    });

    it('should throw an error if all storage writes fail', async () => {
      storage1.write = jest.fn().mockRejectedValue(new Error('Write failed'));
      storage2.write = jest.fn().mockRejectedValue(new Error('Write failed'));
      storage3.write = jest.fn().mockRejectedValue(new Error('Write failed'));

      const path = 'test/path';
      const stream = mockStream();
      await expect(oneOfStorageStrategy.write(path, stream)).rejects.toThrow('Write test/path failed for all storages');
    });

    it('should succeed if one storage write fails but the other succeeds', async () => {
      //given
      storage1.write = jest.fn().mockRejectedValue(new Error('Write failed'));
      storage2.write = jest.fn().mockResolvedValue({ size: 200 });
      storage3.write = jest.fn().mockRejectedValue(new Error('Write failed'));

      const path = 'test/path';
      const stream = mockStream();

      //when
      const result = await oneOfStorageStrategy.write(path, stream);

      //then
      expect(result.size).toBe(200); // Assuming the second storage returned this size
    });

    it('should verify that all data was written to the storage stream', async () => {
      const data = "Test data";
      const stream = new Readable();
      stream.push(data);
      stream.push(null);

      storage1.write = jest.fn().mockImplementation((_, stream) => {
        return new Promise((resolve, reject) => {
          let writtenData = '';
          stream.on('data', chunk => {
            writtenData += chunk;
          });
          stream.on('end', () => {
            if (writtenData === data) {
              resolve({ size: writtenData.length });
            } else {
              reject(new Error('Data mismatch'));
            }
          });
        });
      });

      const result = await oneOfStorageStrategy.write("test/path", stream);

      expect(result.size).toBe(data.length);
    });
  });

  describe('read', () => {
    it('should read from the first storage that has the file', async () => {
      const path = 'test/path';
      const mockStream = new Readable();
      mockStream.push('Test data');
      mockStream.push(null);
      storage1.read = jest.fn().mockResolvedValue(mockStream);
      storage1.exists = jest.fn().mockResolvedValue(true);

      const result = await oneOfStorageStrategy.read(path);

      expect(storage1.exists).toHaveBeenCalledWith(path, undefined);
      expect(storage1.read).toHaveBeenCalledWith(path, undefined);
      expect(result).toBe(mockStream);
    });

    it('should fallback to the next storage if the first fails', async () => {
      const path = 'test/path';
      storage1.read = jest.fn().mockRejectedValue(new Error('Read failed'));
      storage1.exists = jest.fn().mockResolvedValue(true);
      const mockStream = new Readable();
      mockStream.push('Test data');
      mockStream.push(null);
      storage2.read = jest.fn().mockResolvedValue(mockStream);
      storage2.exists = jest.fn().mockResolvedValue(true);

      const result = await oneOfStorageStrategy.read(path);

      expect(storage1.exists).toHaveBeenCalled();
      expect(storage1.read).toHaveBeenCalled();
      expect(storage2.exists).toHaveBeenCalled();
      expect(storage2.read).toHaveBeenCalled();
      expect(result).toBe(mockStream);
    });
  });

  describe('exists', () => {
    it('should return true if the file exists in any storage', async () => {
      storage1.exists = jest.fn().mockResolvedValue(false);
      storage2.exists = jest.fn().mockResolvedValue(true);

      const result = await oneOfStorageStrategy.exists('test/path');

      expect(result).toBe(true);
      expect(storage1.exists).toHaveBeenCalled();
      expect(storage2.exists).toHaveBeenCalled();
    });

    it('should return false if the file does not exist in any storage', async () => {
      storage1.exists = jest.fn().mockResolvedValue(false);
      storage2.exists = jest.fn().mockResolvedValue(false);

      const result = await oneOfStorageStrategy.exists('test/path');

      expect(result).toBe(false);
      expect(storage1.exists).toHaveBeenCalled();
      expect(storage2.exists).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove the file from all storages', async () => {
      const result = await oneOfStorageStrategy.remove('test/path');

      expect(storage1.remove).toHaveBeenCalledWith('test/path', undefined, undefined, undefined);
      expect(storage2.remove).toHaveBeenCalledWith('test/path', undefined, undefined, undefined);
      expect(result).toBe(true);
    });

    it('should return false if any storage fails to remove the file', async () => {
      storage1.remove = jest.fn().mockResolvedValue(true);
      storage2.remove = jest.fn().mockResolvedValue(false);

      const result = await oneOfStorageStrategy.remove('test/path');

      expect(result).toBe(false);
    });
  });
});