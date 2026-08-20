"""The entire error contract.

Every failure leaves the service as {"error": {"code", "message"}}. This shape is
not negotiable.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class NotFoundError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(404, "not_found", message)


class BadRequestError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(400, "bad_request", message)


class PayloadTooLargeError(AppError):
    def __init__(self, message: str = "Request body is too large.") -> None:
        super().__init__(413, "payload_too_large", message)


class ProviderError(AppError):
    """The LLM provider failed or timed out."""

    def __init__(self, message: str) -> None:
        super().__init__(502, "provider_error", message)


def _envelope(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def _too_large() -> JSONResponse:
    return _envelope(413, "payload_too_large", "Request body is too large.")


class BodySizeLimitMiddleware:
    """Reject oversized request bodies."""

    def __init__(self, app, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        raw = Headers(scope=scope).get("content-length")
        if raw is not None:
            try:
                declared = int(raw)
            except ValueError:
                return await _envelope(
                    400, "bad_request", "Malformed Content-Length header."
                )(scope, receive, send)
            if declared > self.max_bytes:
                return await _too_large()(scope, receive, send)

        chunks: list[bytes] = []
        total = 0
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > self.max_bytes:
                return await _too_large()(scope, receive, send)
            chunks.append(chunk)
            more_body = message.get("more_body", False)

        body = b"".join(chunks)
        replayed = False

        async def replay():
            nonlocal replayed
            if replayed:
                # StreamingResponse listens for a real disconnect while its body
                # iterator is awaiting work. Synthesising one here cancels every
                # slow stream immediately after request parsing.
                return await receive()
            replayed = True
            return {"type": "http.request", "body": body, "more_body": False}

        return await self.app(scope, replay, send)


def _first_message(errors: list[dict]) -> str:
    if not errors:
        return "Request body is invalid."
    err = errors[0]
    field = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body",))
    detail = err.get("msg", "is invalid")
    return f"{field} {detail}".strip() if field else detail


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return _envelope(exc.status, exc.code, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Unsupported methods should return 404, not 405, to match the REST
        # contract. Starlette raises 405 by default, so it's normalized here.
        if exc.status_code in (404, 405):
            return _envelope(
                404, "not_found", f"No route for {request.method} {request.url.path}"
            )
        return _envelope(exc.status_code, "bad_request", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI's default is 422 with its own body shape. Express returned 400
        # with our envelope, so it is remapped here. Malformed JSON also arrives
        # as a RequestValidationError, with type "json_invalid".
        errors = exc.errors()
        if errors and errors[0].get("type") == "json_invalid":
            return _envelope(400, "bad_request", "Malformed JSON body.")
        return _envelope(400, "bad_request", _first_message(errors))

    @app.exception_handler(Exception)
    async def _unhandled(_request: Request, exc: Exception) -> JSONResponse:
        print(f"unhandled error: {exc!r}")
        return _envelope(500, "internal_error", "Something went wrong on the server.")
