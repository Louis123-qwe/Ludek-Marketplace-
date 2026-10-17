use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;

use crate::{
    auth::{AuthUser, Claims},
    error::{AppError, AppResult},
    models,
    state::AppState,
};

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncBody {
    full_name: Option<String>,
    role: Option<String>,
    whatsapp: Option<String>,
}

pub async fn sync(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<SyncBody>,
) -> AppResult<Json<Value>> {
    let admin_email = !claims.email.is_empty() && state.cfg.admin_emails.contains(&claims.email);
    let existing = sqlx::query("SELECT status, role FROM users WHERE id = $1")
        .bind(&claims.uid)
        .fetch_optional(&state.db)
        .await?;

    if let Some(row) = existing {
        let status: String = row.try_get("status")?;
        if status == "suspended" {
            return Err(AppError::forbidden("Your account has been suspended. Contact support."));
        }
        let role: String = row.try_get("role")?;
        if admin_email && role != "admin" {
            sqlx::query("UPDATE users SET role = 'admin' WHERE id = $1")
                .bind(&claims.uid)
                .execute(&state.db)
                .await?;
        }
        sqlx::query(
            "UPDATE users SET email = CASE WHEN $2::text <> '' THEN $2::text ELSE email END, avatar_url = CASE WHEN avatar_url = '' THEN $3::text ELSE avatar_url END, updated_at = now() WHERE id = $1",
        )
        .bind(&claims.uid)
        .bind(&claims.email)
        .bind(claims.picture.clone().unwrap_or_default())
        .execute(&state.db)
        .await?;
    } else {
        let settings = models::settings(&state.db).await?;
        if !admin_email && settings["allowSignups"].as_bool() == Some(false) {
            return Err(AppError::forbidden("New sign-ups are paused right now."));
        }
        let role = if admin_email {
            "admin"
        } else if body.role.as_deref() == Some("seller") {
            "seller"
        } else {
            "customer"
        };
        let mut name = models::clean(body.full_name.as_deref().unwrap_or(""), 80);
        if name.is_empty() {
            name = models::clean(claims.name.as_deref().unwrap_or(""), 80);
        }
        if name.is_empty() {
            name = claims.email.split('@').next().unwrap_or("").to_string();
        }
        if name.is_empty() {
            name = "Student".to_string();
        }
        let whatsapp = models::clean(body.whatsapp.as_deref().unwrap_or(""), 20);
        sqlx::query(
            "INSERT INTO users (id, email, full_name, whatsapp, avatar_url, role) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&claims.uid)
        .bind(&claims.email)
        .bind(&name)
        .bind(&whatsapp)
        .bind(claims.picture.clone().unwrap_or_default())
        .bind(role)
        .execute(&state.db)
        .await?;
    }
    Ok(Json(models::user_json(&state.db, &claims.uid).await?))
}

pub async fn get_me(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    Ok(Json(models::user_json(&state.db, &user.id).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePatch {
    full_name: Option<String>,
    store_name: Option<String>,
    bio: Option<String>,
    whatsapp: Option<String>,
    instagram: Option<String>,
    department: Option<String>,
    level: Option<String>,
    avatar_url: Option<String>,
    banner_url: Option<String>,
}

pub async fn patch_me(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ProfilePatch>,
) -> AppResult<Json<Value>> {
    let full_name = models::opt_clean(body.full_name, 80);
    if let Some(name) = &full_name {
        if name.is_empty() {
            return Err(AppError::bad("Your name cannot be empty."));
        }
    }
    let whatsapp = models::opt_clean(body.whatsapp, 20);
    if let Some(number) = &whatsapp {
        if !number.is_empty() && !models::valid_phone(number) {
            return Err(AppError::bad("Enter a valid Nigerian WhatsApp number."));
        }
    }
    let avatar = models::opt_clean(body.avatar_url, 500);
    let banner = models::opt_clean(body.banner_url, 500);
    for url in [&avatar, &banner].into_iter().flatten() {
        if !url.is_empty() && !models::image_url_ok(&state.cfg, url) {
            return Err(AppError::bad("Photos must be uploaded through Ludek Market."));
        }
    }
    sqlx::query(
        "UPDATE users SET full_name = COALESCE($2::text, full_name), store_name = COALESCE($3::text, store_name), bio = COALESCE($4::text, bio), whatsapp = COALESCE($5::text, whatsapp), instagram = COALESCE($6::text, instagram), department = COALESCE($7::text, department), level = COALESCE($8::text, level), avatar_url = COALESCE($9::text, avatar_url), banner_url = COALESCE($10::text, banner_url), updated_at = now() WHERE id = $1",
    )
    .bind(&user.id)
    .bind(full_name)
    .bind(models::opt_clean(body.store_name, 60))
    .bind(models::opt_clean(body.bio, 160))
    .bind(whatsapp)
    .bind(models::opt_clean(body.instagram, 40))
    .bind(models::opt_clean(body.department, 60))
    .bind(models::opt_clean(body.level, 10))
    .bind(avatar)
    .bind(banner)
    .execute(&state.db)
    .await?;
    Ok(Json(models::user_json(&state.db, &user.id).await?))
}

pub async fn stats(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let mut stats = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('activeListings', count(*) FILTER (WHERE status = 'active'), 'soldCount', count(*) FILTER (WHERE status = 'sold'), 'totalViews', COALESCE(sum(views), 0)::bigint, 'chatTaps', COALESCE(sum(chat_taps), 0)::bigint) FROM listings WHERE seller_id = $1",
    )
    .bind(&user.id)
    .fetch_one(&state.db)
    .await?;
    let (rating, count) = sqlx::query_as::<_, (f64, i32)>("SELECT rating, rating_count FROM users WHERE id = $1")
        .bind(&user.id)
        .fetch_one(&state.db)
        .await?;
    let sales_count = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM sales WHERE seller_id = $1")
        .bind(&user.id)
        .fetch_one(&state.db)
        .await?;
    if let Some(map) = stats.as_object_mut() {
        map.insert("salesCount".to_string(), json!(sales_count));
        map.insert("rating".to_string(), json!(rating));
        map.insert("ratingCount".to_string(), json!(count));
    }
    Ok(Json(stats))
}

#[derive(Deserialize)]
pub struct MineQuery {
    status: Option<String>,
    q: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn listings(
    State(state): State<AppState>,
    user: AuthUser,
    Query(q): Query<MineQuery>,
) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 20, 50);
    let status = models::nz(q.status);
    let search = models::nz(q.q);
    let filter = "WHERE l.seller_id = $1 AND ($2::text IS NULL OR l.status = $2) AND ($3::text IS NULL OR l.title ILIKE '%' || $3 || '%')";
    let list_sql = format!(
        "SELECT {} FROM {} {} ORDER BY l.created_at DESC LIMIT $4 OFFSET $5",
        models::LISTING_JSON,
        models::LISTING_FROM,
        filter
    );
    let count_sql = format!("SELECT count(*) FROM {} {}", models::LISTING_FROM, filter);
    let items = sqlx::query_scalar::<_, Value>(&list_sql)
        .bind(&user.id)
        .bind(status.clone())
        .bind(search.clone())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .bind(&user.id)
        .bind(status)
        .bind(search)
        .fetch_one(&state.db)
        .await?;
    let counts = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('all', count(*), 'active', count(*) FILTER (WHERE status = 'active'), 'pending', count(*) FILTER (WHERE status = 'pending'), 'draft', count(*) FILTER (WHERE status = 'draft'), 'sold', count(*) FILTER (WHERE status = 'sold')) FROM listings WHERE seller_id = $1",
    )
    .bind(&user.id)
    .fetch_one(&state.db)
    .await?;
    let mut body = models::page_json(items, total, page, limit);
    if let Some(map) = body.as_object_mut() {
        map.insert("counts".to_string(), counts);
    }
    Ok(Json(body))
}

pub async fn notifications(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', id, 'title', title, 'message', message, 'link', link, 'read', read, 'createdAt', created_at) FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn unread(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let count = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM notifications WHERE user_id = $1 AND NOT read")
        .bind(&user.id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(json!({ "count": count })))
}

pub async fn mark_read(State(state): State<AppState>, user: AuthUser) -> AppResult<StatusCode> {
    sqlx::query("UPDATE notifications SET read = TRUE WHERE user_id = $1 AND NOT read")
        .bind(&user.id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn favorites(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let sql = format!(
        "SELECT {} FROM favorites f JOIN listings l ON l.id = f.listing_id JOIN users u ON u.id = l.seller_id WHERE f.user_id = $1 ORDER BY f.created_at DESC",
        models::LISTING_JSON
    );
    let items = sqlx::query_scalar::<_, Value>(&sql)
        .bind(&user.id)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn favorite_ids(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let ids = sqlx::query_scalar::<_, String>("SELECT listing_id FROM favorites WHERE user_id = $1")
        .bind(&user.id)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(json!({ "ids": ids })))
}

pub async fn add_favorite(
    State(state): State<AppState>,
    user: AuthUser,
    Path(listing_id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query(
        "INSERT INTO favorites (user_id, listing_id) SELECT $1, id FROM listings WHERE id = $2 ON CONFLICT DO NOTHING",
    )
    .bind(&user.id)
    .bind(&listing_id)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_favorite(
    State(state): State<AppState>,
    user: AuthUser,
    Path(listing_id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2")
        .bind(&user.id)
        .bind(&listing_id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
