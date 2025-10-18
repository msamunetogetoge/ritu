/* ServiceErrorはHTTPステータス付きのドメインエラーを表す。 */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/* 404専用のヘルパ。 */
export function notFound(message: string): ServiceError {
  return new ServiceError(message, 404, "not_found");
}

/* リクエスト検証失敗時の400エラーを生成。 */
export function validationError(message: string): ServiceError {
  return new ServiceError(message, 400, "validation_error");
}

/* 認可エラー用の403ヘルパ。 */
export function forbidden(message: string): ServiceError {
  return new ServiceError(message, 403, "forbidden");
}
