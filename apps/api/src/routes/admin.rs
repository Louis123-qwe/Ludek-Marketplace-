use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    auth::AdminUser,
    error::{AppError, AppResult},
    models,
    state::AppState,
};

pub async fn overview(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Value>> {
    let stats = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('users', (SELECT count(*) FROM users), 'sellers', (SELECT count(*) FROM users WHERE role = 'seller'), 'listings', (SELECT count(*) FROM listings), 'activeListings', (SELECT count(*) FROM listings WHERE status = 'active'), 'pendingListings', (SELECT count(*) FROM listings WHERE status = 'pending'), 'openReports', (SELECT count(*) FROM reports WHERE status = 'open'), 'viewsToday', COALESCE((SELECT views FROM daily_views WHERE day = current_date), 0))",
    )
    .fetch_one(&state.db)
    .await?;
    let users_sql = format!("SELECT {} FROM users u ORDER BY u.created_at DESC LIMIT 5", models::USER_JSON);
    let recent_users = sqlx::query_scalar::<_, Value>(&users_sql).fetch_all(&state.db).await?;
    let listings_sql = format!(
        "SELECT {} FROM {} ORDER BY l.created_at DESC LIMIT 5",
        models::LISTING_JSON,
        models::LISTING_FROM
    );
    let recent_listings = sqlx::query_scalar::<_, Value>(&listings_sql).fetch_all(&state.db).await?;
    Ok(Json(json!({ "stats": stats, "recentUsers": recent_users, "recentListings": recent_listings })))
}

#[derive(Deserialize)]
pub struct UsersQuery {
    q: Option<String>,
    role: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn list_users(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<UsersQuery>,
) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 20, 50);
    let role = models::nz(q.role);
    let search = models::nz(q.q);
    let filter = "WHERE ($1::text IS NULL OR u.role = $1) AND ($2::text IS NULL OR u.full_name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')";
    let list_sql = format!(
        "SELECT {} FROM users u {} ORDER BY u.created_at DESC LIMIT $3 OFFSET $4",
        models::USER_JSON,
        filter
    );
    let count_sql = format!("SELECT count(*) FROM users u {}", filter);
    let items = sqlx::query_scalar::<_, Value>(&list_sql)
        .bind(role.clone())
        .bind(search.clone())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .bind(role)
        .bind(search)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(models::page_json(items, total, page, limit)))
}

#[derive(Deserialize)]
pub struct UserPatch {
    role: Option<String>,
    status: Option<String>,
    verified: Option<bool>,
}

pub async fn patch_user(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
    Json(body): Json<UserPatch>,
) -> AppResult<Json<Value>> {
    if id == admin.id && (body.role.is_some() || body.status.is_some()) {
        return Err(AppError::bad("You cannot change your own role or status."));
    }
    if let Some(role) = &body.role {
        if !["customer", "seller", "admin"].contains(&role.as_str()) {
            return Err(AppError::bad("Unknown role."));
        }
    }
    if let Some(status) = &body.status {
        if !["active", "suspended"].contains(&status.as_str()) {
            return Err(AppError::bad("Unknown status."));
        }
    }
    let done = sqlx::query(
        "UPDATE users SET role = COALESCE($2::text, role), status = COALESCE($3::text, status), verified = COALESCE($4::boolean, verified), updated_at = now() WHERE id = $1",
    )
    .bind(&id)
    .bind(body.role.clone())
    .bind(body.status.clone())
    .bind(body.verified)
    .execute(&state.db)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::not_found("User not found."));
    }
    let mut parts: Vec<String> = Vec::new();
    if let Some(r) = &body.role {
        parts.push(format!("role {}", r));
    }
    if let Some(s) = &body.status {
        parts.push(format!("status {}", s));
    }
    if let Some(v) = body.verified {
        parts.push(if v { "verified".to_string() } else { "unverified".to_string() });
        if v {
            models::notify_user(
                &state.db,
                &id,
                "You are a verified seller",
                "Your store now shows a verified shield on every listing.",
                "/dashboard",
            )
            .await;
        }
    }
    models::audit(&state.db, "admin", &admin.name, "User updated", &format!("{}: {}", id, parts.join(", "))).await;
    Ok(Json(models::user_json(&state.db, &id).await?))
}

#[derive(Deserialize)]
pub struct AdminListingsQuery {
    q: Option<String>,
    status: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn list_listings(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<AdminListingsQuery>,
) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 20, 50);
    let status = models::nz(q.status);
    let search = models::nz(q.q);
    let filter = "WHERE ($1::text IS NULL OR l.status = $1) AND ($2::text IS NULL OR l.title ILIKE '%' || $2 || '%' OR u.full_name ILIKE '%' || $2 || '%')";
    let list_sql = format!(
        "SELECT {} FROM {} {} ORDER BY l.created_at DESC LIMIT $3 OFFSET $4",
        models::LISTING_JSON,
        models::LISTING_FROM,
        filter
    );
    let count_sql = format!("SELECT count(*) FROM {} {}", models::LISTING_FROM, filter);
    let items = sqlx::query_scalar::<_, Value>(&list_sql)
        .bind(status.clone())
        .bind(search.clone())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .bind(status)
        .bind(search)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(models::page_json(items, total, page, limit)))
}

#[derive(Deserialize)]
pub struct AdminListingPatch {
    status: Option<String>,
    featured: Option<bool>,
}

pub async fn patch_listing(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
    Json(body): Json<AdminListingPatch>,
) -> AppResult<Json<Value>> {
    if let Some(status) = &body.status {
        if !["active", "sold", "draft", "pending"].contains(&status.as_str()) {
            return Err(AppError::bad("Unknown status."));
        }
    }
    let row = sqlx::query_as::<_, (String, String, String)>("SELECT status, seller_id, title FROM listings WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("Listing not found."))?;
    let (previous, seller_id, title) = row;
    sqlx::query(
        "UPDATE listings SET status = COALESCE($2::text, status), featured = COALESCE($3::boolean, featured), updated_at = now() WHERE id = $1",
    )
    .bind(&id)
    .bind(body.status.clone())
    .bind(body.featured)
    .execute(&state.db)
    .await?;
    if let Some(status) = &body.status {
        if status == "active" && previous == "pending" {
            models::notify_user(
                &state.db,
                &seller_id,
                "Your listing is live",
                &format!("{} was approved and is now visible to buyers.", title),
                &format!("/product/{}", id),
            )
            .await;
        }
        if status == "sold" && previous != "sold" {
            models::record_sale(&state.db, &id, "").await?;
        }
    }
    models::audit(&state.db, "admin", &admin.name, "Listing updated", &title).await;
    Ok(Json(models::listing_json(&state.db, &id).await?))
}

pub async fn delete_listing(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let title = sqlx::query_scalar::<_, String>("SELECT title FROM listings WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("Listing not found."))?;
    sqlx::query("DELETE FROM listings WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    models::audit(&state.db, "admin", &admin.name, "Listing deleted", &title).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBody {
    name: Option<String>,
    slug: Option<String>,
    icon: Option<String>,
    image_url: Option<String>,
    order: Option<i32>,
}

pub async fn create_category(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Json(body): Json<CategoryBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let name = models::clean(body.name.as_deref().unwrap_or(""), 30);
    if name.is_empty() {
        return Err(AppError::bad("Enter a category name."));
    }
    let slug = {
        let given = models::slugify(body.slug.as_deref().unwrap_or(""));
        if given.is_empty() {
            models::slugify(&name)
        } else {
            given
        }
    };
    let icon = models::clean(body.icon.as_deref().unwrap_or("tag"), 20);
    let image = models::clean(body.image_url.as_deref().unwrap_or(""), 500);
    if !image.is_empty() && !models::image_url_ok(&state.cfg, &image) {
        return Err(AppError::bad("Photos must be uploaded through Ludek Market."));
    }
    let created = sqlx::query_scalar::<_, Value>(
        "INSERT INTO categories (slug, name, icon, image_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING jsonb_build_object('id', id, 'slug', slug, 'name', name, 'icon', icon, 'imageUrl', image_url, 'order', sort_order)",
    )
    .bind(&slug)
    .bind(&name)
    .bind(&icon)
    .bind(&image)
    .bind(body.order.unwrap_or(0))
    .fetch_one(&state.db)
    .await?;
    models::audit(&state.db, "admin", &admin.name, "Category added", &name).await;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn update_category(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
    Json(body): Json<CategoryBody>,
) -> AppResult<Json<Value>> {
    let image = models::opt_clean(body.image_url, 500);
    if let Some(url) = &image {
        if !url.is_empty() && !models::image_url_ok(&state.cfg, url) {
            return Err(AppError::bad("Photos must be uploaded through Ludek Market."));
        }
    }
    let updated = sqlx::query_scalar::<_, Value>(
        "UPDATE categories SET name = COALESCE($2::text, name), icon = COALESCE($3::text, icon), image_url = COALESCE($4::text, image_url), sort_order = COALESCE($5::int, sort_order) WHERE id = $1 RETURNING jsonb_build_object('id', id, 'slug', slug, 'name', name, 'icon', icon, 'imageUrl', image_url, 'order', sort_order)",
    )
    .bind(&id)
    .bind(models::opt_clean(body.name, 30))
    .bind(models::opt_clean(body.icon, 20))
    .bind(image)
    .bind(body.order)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::not_found("Category not found."))?;
    models::audit(&state.db, "admin", &admin.name, "Category updated", &id).await;
    Ok(Json(updated))
}

pub async fn delete_category(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    models::audit(&state.db, "admin", &admin.name, "Category deleted", &id).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct ReportsQuery {
    status: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn list_reports(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<ReportsQuery>,
) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 20, 50);
    let status = models::nz(q.status);
    let from = "FROM reports r LEFT JOIN users u ON u.id = r.reporter_id WHERE ($1::text IS NULL OR r.status = $1)";
    let list_sql = format!(
        "SELECT jsonb_build_object('id', r.id, 'targetType', r.target_type, 'targetId', r.target_id, 'targetName', r.target_name, 'reason', r.reason, 'details', r.details, 'status', r.status, 'note', r.note, 'createdAt', r.created_at, 'reporter', jsonb_build_object('id', u.id, 'fullName', u.full_name)) {} ORDER BY r.created_at DESC LIMIT $2 OFFSET $3",
        from
    );
    let count_sql = format!("SELECT count(*) {}", from);
    let items = sqlx::query_scalar::<_, Value>(&list_sql)
        .bind(status.clone())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .bind(status)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(models::page_json(items, total, page, limit)))
}

#[derive(Deserialize)]
pub struct ReportPatch {
    status: String,
    note: Option<String>,
}

pub async fn patch_report(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
    Json(body): Json<ReportPatch>,
) -> AppResult<Json<Value>> {
    if body.status != "resolved" && body.status != "dismissed" {
        return Err(AppError::bad("Status must be resolved or dismissed."));
    }
    let done = sqlx::query("UPDATE reports SET status = $2, note = $3 WHERE id = $1")
        .bind(&id)
        .bind(&body.status)
        .bind(models::clean(body.note.as_deref().unwrap_or(""), 300))
        .execute(&state.db)
        .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::not_found("Report not found."));
    }
    models::audit(&state.db, "admin", &admin.name, &format!("Report {}", body.status), &id).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct AnnouncementBody {
    title: String,
    message: String,
    audience: Option<String>,
    link: Option<String>,
}

pub async fn list_announcements(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Value>> {
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', id, 'title', title, 'message', message, 'audience', audience, 'link', link, 'createdAt', created_at) FROM announcements ORDER BY created_at DESC LIMIT 50",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(Value::Array(items)))
}

pub async fn create_announcement(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Json(body): Json<AnnouncementBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let title = models::clean(&body.title, 80);
    let message = models::clean(&body.message, 400);
    if title.is_empty() || message.is_empty() {
        return Err(AppError::bad("Add a title and a message."));
    }
    let audience = match body.audience.as_deref() {
        Some("seller") => "seller",
        Some("customer") => "customer",
        _ => "all",
    };
    let link = models::clean(body.link.as_deref().unwrap_or(""), 200);
    if !models::safe_link(&link) {
        return Err(AppError::bad("Links must start with / or https://"));
    }
    sqlx::query("INSERT INTO announcements (title, message, audience, link) VALUES ($1, $2, $3, $4)")
        .bind(&title)
        .bind(&message)
        .bind(audience)
        .bind(&link)
        .execute(&state.db)
        .await?;
    sqlx::query(
        "INSERT INTO notifications (user_id, title, message, link) SELECT id, $1, $2, $3 FROM users WHERE status = 'active' AND ($4::text = 'all' OR role = $4::text)",
    )
    .bind(&title)
    .bind(&message)
    .bind(&link)
    .bind(audience)
    .execute(&state.db)
    .await?;
    models::audit(&state.db, "admin", &admin.name, "Announcement sent", &title).await;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true }))))
}

pub async fn delete_announcement(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM announcements WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    models::audit(&state.db, "admin", &admin.name, "Announcement removed", &id).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct NotifyBody {
    email: String,
    title: String,
    message: String,
    link: Option<String>,
}

pub async fn notify_member(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Json(body): Json<NotifyBody>,
) -> AppResult<Json<Value>> {
    let link = models::clean(body.link.as_deref().unwrap_or(""), 200);
    if !models::safe_link(&link) {
        return Err(AppError::bad("Links must start with / or https://"));
    }
    let id = sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE lower(email) = lower($1)")
        .bind(body.email.trim())
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("No member uses that email."))?;
    models::notify_user(
        &state.db,
        &id,
        &models::clean(&body.title, 80),
        &models::clean(&body.message, 400),
        &link,
    )
    .await;
    models::audit(&state.db, "admin", &admin.name, "Message sent", body.email.trim()).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct TickerBody {
    text: Option<String>,
    link: Option<String>,
    active: Option<bool>,
}

const TICKER_JSON: &str = "jsonb_build_object('id', id, 'text', text, 'link', link, 'active', active, 'order', sort_order)";

pub async fn list_ticker(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Value>> {
    let sql = format!("SELECT {} FROM ticker_messages ORDER BY sort_order, created_at DESC", TICKER_JSON);
    let items = sqlx::query_scalar::<_, Value>(&sql).fetch_all(&state.db).await?;
    Ok(Json(Value::Array(items)))
}

pub async fn create_ticker(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Json(body): Json<TickerBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let text = models::clean(body.text.as_deref().unwrap_or(""), 120);
    if text.is_empty() {
        return Err(AppError::bad("Enter a message."));
    }
    let link = models::clean(body.link.as_deref().unwrap_or(""), 200);
    if !models::safe_link(&link) {
        return Err(AppError::bad("Links must start with / or https://"));
    }
    let sql = format!(
        "INSERT INTO ticker_messages (text, link, active) VALUES ($1, $2, $3) RETURNING {}",
        TICKER_JSON
    );
    let created = sqlx::query_scalar::<_, Value>(&sql)
        .bind(&text)
        .bind(&link)
        .bind(body.active.unwrap_or(true))
        .fetch_one(&state.db)
        .await?;
    models::audit(&state.db, "admin", &admin.name, "Ticker message added", &text).await;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn update_ticker(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
    Json(body): Json<TickerBody>,
) -> AppResult<Json<Value>> {
    let link = models::opt_clean(body.link, 200);
    if let Some(l) = &link {
        if !models::safe_link(l) {
            return Err(AppError::bad("Links must start with / or https://"));
        }
    }
    let sql = format!(
        "UPDATE ticker_messages SET text = COALESCE($2::text, text), link = COALESCE($3::text, link), active = COALESCE($4::boolean, active) WHERE id = $1 RETURNING {}",
        TICKER_JSON
    );
    let updated = sqlx::query_scalar::<_, Value>(&sql)
        .bind(&id)
        .bind(models::opt_clean(body.text, 120))
        .bind(link)
        .bind(body.active)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("Message not found."))?;
    models::audit(&state.db, "admin", &admin.name, "Ticker message updated", &id).await;
    Ok(Json(updated))
}

pub async fn delete_ticker(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM ticker_messages WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    models::audit(&state.db, "admin", &admin.name, "Ticker message deleted", &id).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdBody {
    tag: Option<String>,
    title: Option<String>,
    body: Option<String>,
    button_text: Option<String>,
    link: Option<String>,
    bg: Option<String>,
    image_url: Option<String>,
    layout: Option<String>,
    active: Option<bool>,
}

const AD_JSON: &str = "jsonb_build_object('id', id, 'tag', tag, 'title', title, 'body', body, 'buttonText', button_text, 'link', link, 'bg', bg, 'imageUrl', image_url, 'layout', layout, 'active', active)";

pub async fn list_ads(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Value>> {
    let sql = format!("SELECT {} FROM ads ORDER BY sort_order, created_at DESC", AD_JSON);
    let items = sqlx::query_scalar::<_, Value>(&sql).fetch_all(&state.db).await?;
    Ok(Json(Value::Array(items)))
}

pub async fn create_ad(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Json(body): Json<AdBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let title = models::clean(body.title.as_deref().unwrap_or(""), 80);
    if title.is_empty() {
        return Err(AppError::bad("Enter an ad headline."));
    }
    let link = models::clean(body.link.as_deref().unwrap_or(""), 200);
    if !models::safe_link(&link) {
        return Err(AppError::bad("Links must start with / or https://"));
    }
    let bg = body
        .bg
        .clone()
        .filter(|b| models::ad_bg_ok(b))
        .unwrap_or_else(|| "forest".to_string());
    let layout = match body.layout.as_deref() {
        Some("full") => "full",
        _ => "side",
    };
    let image_url = body.image_url.as_deref().unwrap_or("").trim().to_string();
    if !image_url.is_empty() && !models::image_url_ok(&state.cfg, &image_url) {
        return Err(AppError::bad("Upload the ad picture with the upload button."));
    }
    let sql = format!(
        "INSERT INTO ads (tag, title, body, button_text, link, bg, image_url, layout, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING {}",
        AD_JSON
    );
    let created = sqlx::query_scalar::<_, Value>(&sql)
        .bind(models::clean(body.tag.as_deref().unwrap_or("Sponsored"), 20))
        .bind(&title)
        .bind(models::clean(body.body.as_deref().unwrap_or(""), 160))
        .bind(models::clean(body.button_text.as_deref().unwrap_or("Learn more"), 24))
        .bind(&link)
        .bind(&bg)
        .bind(&image_url)
        .bind(layout)
        .bind(body.active.unwrap_or(true))
        .fetch_one(&state.db)
        .await?;
    models::audit(&state.db, "admin", &admin.name, "Ad created", &title).await;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn update_ad(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
    Json(body): Json<AdBody>,
) -> AppResult<Json<Value>> {
    let link = models::opt_clean(body.link, 200);
    if let Some(l) = &link {
        if !models::safe_link(l) {
            return Err(AppError::bad("Links must start with / or https://"));
        }
    }
    let image_url = body.image_url.as_deref().map(|v| v.trim().to_string());
    if let Some(url) = &image_url {
        if !url.is_empty() && !models::image_url_ok(&state.cfg, url) {
            return Err(AppError::bad("Upload the ad picture with the upload button."));
        }
    }
    let layout = body
        .layout
        .as_deref()
        .filter(|l| *l == "side" || *l == "full")
        .map(str::to_string);
    let sql = format!(
        "UPDATE ads SET tag = COALESCE($2::text, tag), title = COALESCE($3::text, title), body = COALESCE($4::text, body), button_text = COALESCE($5::text, button_text), link = COALESCE($6::text, link), bg = COALESCE($7::text, bg), image_url = COALESCE($8::text, image_url), layout = COALESCE($9::text, layout), active = COALESCE($10::boolean, active) WHERE id = $1 RETURNING {}",
        AD_JSON
    );
    let updated = sqlx::query_scalar::<_, Value>(&sql)
        .bind(&id)
        .bind(models::opt_clean(body.tag, 20))
        .bind(models::opt_clean(body.title, 80))
        .bind(models::opt_clean(body.body, 160))
        .bind(models::opt_clean(body.button_text, 24))
        .bind(link)
        .bind(body.bg.filter(|b| models::ad_bg_ok(b)))
        .bind(image_url)
        .bind(layout)
        .bind(body.active)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("Ad not found."))?;
    models::audit(&state.db, "admin", &admin.name, "Ad updated", &id).await;
    Ok(Json(updated))
}

pub async fn delete_ad(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM ads WHERE id = $1").bind(&id).execute(&state.db).await?;
    models::audit(&state.db, "admin", &admin.name, "Ad deleted", &id).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_settings(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Value>> {
    Ok(Json(models::settings(&state.db).await?))
}

pub async fn put_settings(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let mut merged = models::settings(&state.db).await?;
    let bool_keys = [
        "requireApproval",
        "allowSignups",
        "maintenance",
        "showLiveProducts",
        "showRecentSales",
        "showAdminMessages",
        "showAds",
    ];
    if let (Some(base), Some(input)) = (merged.as_object_mut(), body.as_object()) {
        for key in bool_keys {
            if let Some(v) = input.get(key).and_then(|v| v.as_bool()) {
                base.insert(key.to_string(), Value::Bool(v));
            }
        }
        for key in ["supportEmail", "supportWhatsapp"] {
            if let Some(v) = input.get(key).and_then(|v| v.as_str()) {
                base.insert(key.to_string(), Value::String(models::clean(v, 120)));
            }
        }
    }
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('platform', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(&merged)
    .execute(&state.db)
    .await?;
    models::audit(&state.db, "admin", &admin.name, "Settings changed", "platform").await;
    Ok(Json(merged))
}

#[derive(Deserialize)]
pub struct LogsQuery {
    kind: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

pub async fn logs(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<LogsQuery>,
) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 30, 100);
    let kind = models::nz(q.kind);
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', id, 'kind', kind, 'actor', actor, 'action', action, 'target', target, 'createdAt', created_at) FROM audit_logs WHERE ($1::text IS NULL OR kind = $1) ORDER BY id DESC LIMIT $2 OFFSET $3",
    )
    .bind(kind.clone())
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;
    let total = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM audit_logs WHERE ($1::text IS NULL OR kind = $1)")
        .bind(kind)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(models::page_json(items, total, page, limit)))
}


pub async fn sales(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<LogsQuery>,
) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 30, 100);
    let source = models::nz(q.kind);
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', s.id, 'title', s.title, 'price', s.price, 'source', s.source, 'buyerName', s.buyer_name, 'sellerName', u.full_name, 'listingId', s.listing_id, 'createdAt', s.created_at) FROM sales s JOIN users u ON u.id = s.seller_id WHERE ($1::text IS NULL OR s.source = $1) ORDER BY s.created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(source.clone())
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;
    let (total, value) = sqlx::query_as::<_, (i64, i64)>(
        "SELECT count(*), COALESCE(sum(price), 0)::bigint FROM sales WHERE ($1::text IS NULL OR source = $1)",
    )
    .bind(source)
    .fetch_one(&state.db)
    .await?;
    let mut out = models::page_json(items, total, page, limit);
    if let Some(map) = out.as_object_mut() {
        map.insert("totalValue".to_string(), json!(value));
    }
    Ok(Json(out))
}
