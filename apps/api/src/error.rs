use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    Conflict(String),
    Unavailable(String),
    Internal(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn bad(message: &str) -> Self {
        AppError::BadRequest(message.to_string())
    }
    pub fn forbidden(message: &str) -> Self {
        AppError::Forbidden(message.to_string())
    }
    pub fn not_found(message: &str) -> Self {
        AppError::NotFound(message.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m),
            AppError::Forbidden(m) => (StatusCode::FORBIDDEN, m),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::Conflict(m) => (StatusCode::CONFLICT, m),
            AppError::Unavailable(m) => (StatusCode::SERVICE_UNAVAILABLE, m),
            AppError::Internal(m) => {
                tracing::error!("{}", m);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong on our side. Try again.".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => AppError::NotFound("Not found.".to_string()),
            sqlx::Error::Database(db) if db.is_unique_violation() => {
                AppError::Conflict("That already exists.".to_string())
            }
            _ => AppError::Internal(err.to_string()),
        }
    }
}
