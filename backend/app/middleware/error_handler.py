import logging
import traceback
from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from pydantic import ValidationError

logger = logging.getLogger("spildenah")

async def error_handler_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.exception("Unhandled exception")
        
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        detail = "Internal Server Error"
        
        if isinstance(e, IntegrityError):
            status_code = status.HTTP_409_CONFLICT
            detail = "Database Integrity Error"
        elif isinstance(e, SQLAlchemyError):
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            detail = "Database Error"
        elif isinstance(e, ValidationError):
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            detail = "Validation Error"
            
        return JSONResponse(
            status_code=status_code,
            content={
                "error": e.__class__.__name__,
                "detail": detail,
                # "traceback": traceback.format_exc() if settings.ENVIRONMENT == "development" else None
            }
        )
