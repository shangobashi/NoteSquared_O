from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .errors import AppError
from .routes.health import router as health_router
from .routes.students import router as students_router
from .routes.lessons import router as lessons_router
from .routes.outputs import router as outputs_router

app = FastAPI(title="Note^2 API", version="0.1.0")

app.include_router(health_router)
app.include_router(students_router)
app.include_router(lessons_router)
app.include_router(outputs_router)


@app.exception_handler(AppError)
def app_error_handler(_, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"success": False, "error": {"code": exc.code, "message": exc.message}})
