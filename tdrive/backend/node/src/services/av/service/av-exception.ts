export class AVException extends Error {
  constructor(readonly details: string, readonly status: number) {
    super();
    this.message = details;
  }

  static initializationFailed(details: string): AVException {
    return new AVException(details, 503);
  }

  static fileNotFound(details: string): AVException {
    return new AVException(details, 404);
  }

  static scanFailed(details: string): AVException {
    return new AVException(details, 500);
  }

  static handleError(cause: Error, newException: AVException): void {
    throw cause instanceof AVException ? cause : newException;
  }
}
