use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models,
    state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewBody {
    rating: i32,
    comment: Option<String>,
    listing_id: Option<String>,
}

pub async fn add_review(
    State(state): State<AppState>,
    user: AuthUser,
    Path(seller_id): Path<String>,
    Json(body): Json<ReviewBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if user.id == seller_id {
        return Err(AppError::bad("You cannot review yourself."));
    }
    if !(1..=5).contains(&body.rating) {
        return Err(AppError::bad("Pick a rating from 1 to 5."));
    }
    let exists = sqlx::query_scalar::<_, i32>("SELECT 1 FROM users WHERE id = $1")
        .bind(&seller_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::not_found("Seller not found."));
    }
    let comment = models::clean(body.comment.as_deref().unwrap_or(""), 400);
    sqlx::query(
        "INSERT INTO reviews (seller_id, reviewer_id, listing_id, rating, comment) VALUES ($1, $2, $3, $4::smallint, $5) ON CONFLICT (seller_id, reviewer_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, listing_id = EXCLUDED.listing_id, created_at = now()",
    )
    .bind(&seller_id)
    .bind(&user.id)
    .bind(body.listing_id)
    .bind(body.rating)
    .bind(&comment)
    .execute(&state.db)
    .await?;
    sqlx::query(
        "UPDATE users SET rating = COALESCE((SELECT avg(rating)::float8 FROM reviews WHERE seller_id = $1), 0), rating_count = (SELECT count(*)::int FROM reviews WHERE seller_id = $1) WHERE id = $1",
    )
    .bind(&seller_id)
    .execute(&state.db)
    .await?;
    models::notify_user(
        &state.db,
        &seller_id,
        "New review",
        &format!("{} left you a {}-star review.", user.name, body.rating),
        &format!("/seller/{}", seller_id),
    )
    .await;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true }))))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportBody {
    target_type: String,
    target_id: String,
    target_name: Option<String>,
    reason: String,
    details: Option<String>,
}

pub async fn create_report(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ReportBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.target_type != "listing" && body.target_type != "user" {
        return Err(AppError::bad("Unknown report type."));
    }
    let reason = models::clean(&body.reason, 60);
    if reason.is_empty() {
        return Err(AppError::bad("Choose a reason."));
    }
    let duplicate = sqlx::query_scalar::<_, i32>(
        "SELECT 1 FROM reports WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'",
    )
    .bind(&user.id)
    .bind(&body.target_type)
    .bind(&body.target_id)
    .fetch_optional(&state.db)
    .await?;
    if duplicate.is_some() {
        return Err(AppError::Conflict("You already reported this.".to_string()));
    }
    let name = models::clean(body.target_name.as_deref().unwrap_or(""), 120);
    sqlx::query(
        "INSERT INTO reports (reporter_id, target_type, target_id, target_name, reason, details) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&user.id)
    .bind(&body.target_type)
    .bind(&body.target_id)
    .bind(&name)
    .bind(&reason)
    .bind(models::clean(body.details.as_deref().unwrap_or(""), 500))
    .execute(&state.db)
    .await?;
    models::notify_admins(&state.db, "New report", &format!("{}: {}", reason, name), "/admin/reports").await;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true }))))
}

#[derive(Deserialize)]
pub struct SignBody {
    folder: Option<String>,
}

pub async fn upload_config(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(body): Json<SignBody>,
) -> AppResult<Json<Value>> {
    let (cloud, preset) = match (&state.cfg.cloudinary_cloud_name, &state.cfg.cloudinary_upload_preset) {
        (Some(c), Some(p)) => (c.clone(), p.clone()),
        _ => return Err(AppError::Unavailable("Photo uploads are not set up yet.".to_string())),
    };
    let folder = match body.folder.as_deref() {
        Some("avatars") => "ludek/avatars",
        Some("banners") => "ludek/banners",
        Some("categories") => "ludek/categories",
        Some("ads") => "ludek/ads",
        _ => "ludek/listings",
    };
    Ok(Json(json!({ "cloudName": cloud, "uploadPreset": preset, "folder": folder })))
}
