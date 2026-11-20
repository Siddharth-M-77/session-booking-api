export class ApiResponse<T = unknown> {
  public readonly success: boolean;
  public readonly message: string;
  public readonly data: T;

  constructor(statusCode: number, message: string, data: T) {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}
