use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    auth::OptUser,
    error::{AppError, AppResult},
    models,
    state::AppState,
};

#[derive(Deserialize)]
pub struct ListQuery {
    q: Option<String>,
    category: Option<String>,
    sort: Option<String>,
    condition: Option<String>,
    min: Option<i64>,
    max: Option<i64>,
    seller: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

const LIST_FILTER: &str = "WHERE l.status = 'active' AND u.status = 'active' AND ($1::text IS NULL OR l.category = $1) AND ($2::text IS NULL OR l.condition = $2) AND ($3::bigint IS NULL OR l.price >= $3) AND ($4::bigint IS NULL OR l.price <= $4) AND ($5::text IS NULL OR l.seller_id = $5) AND ($6::text IS NULL OR l.title ILIKE '%' || $6 || '%' OR l.description ILIKE '%' || $6 || '%')";

pub async fn list_listings(State(state): State<AppState>, Query(q): Query<ListQuery>) -> AppResult<Json<Value>> {
    let (page, limit, offset) = models::page_args(q.page, q.limit, 12, 50);
    let order = match q.sort.as_deref() {
        Some("price-asc") => "l.price ASC, l.created_at DESC",
        Some("price-desc") => "l.price DESC, l.created_at DESC",
        Some("popular") => "l.views DESC, l.created_at DESC",
        _ => "l.featured DESC, l.created_at DESC",
    };
    let list_sql = format!(
        "SELECT {} FROM {} {} ORDER BY {} LIMIT $7 OFFSET $8",
        models::LISTING_JSON,
        models::LISTING_FROM,
        LIST_FILTER,
        order
    );
    let count_sql = format!("SELECT count(*) FROM {} {}", models::LISTING_FROM, LIST_FILTER);

    let category = models::nz(q.category);
    let condition = models::nz(q.condition);
    let seller = models::nz(q.seller);
    let search = models::nz(q.q);

    let items = sqlx::query_scalar::<_, Value>(&list_sql)
        .bind(category.clone())
        .bind(condition.clone())
        .bind(q.min)
        .bind(q.max)
        .bind(seller.clone())
        .bind(search.clone())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;
    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .bind(category)
        .bind(condition)
        .bind(q.min)
        .bind(q.max)
        .bind(seller)
        .bind(search)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(models::page_json(items, total, page, limit)))
}

pub async fn get_listing(
    State(state): State<AppState>,
    OptUser(viewer): OptUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let listing = models::listing_json(&state.db, &id).await?;
    let status = listing["status"].as_str().unwrap_or("").to_string();
    let seller_id = listing["sellerId"].as_str().unwrap_or("").to_string();
    let seller_active = listing["seller"]["status"].as_str() == Some("active");
    let visible = (status == "active" || status == "sold") && seller_active;
    let staff = viewer
        .as_ref()
        .map(|v| v.id == seller_id || v.is_admin())
        .unwrap_or(false);
    if !visible && !staff {
        return Err(AppError::not_found("Listing not found."));
    }
    Ok(Json(listing))
}

pub async fn track_view(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<StatusCode> {
    let done = sqlx::query("UPDATE listings SET views = views + 1 WHERE id = $1 AND status IN ('active', 'sold')")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if done.rows_affected() > 0 {
        sqlx::query(
            "INSERT INTO daily_views (day, views) VALUES (current_date, 1) ON CONFLICT (day) DO UPDATE SET views = daily_views.views + 1",
        )
        .execute(&state.db)
        .await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn track_chat(
    State(state): State<AppState>,
    OptUser(viewer): OptUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let done = sqlx::query("UPDATE listings SET chat_taps = chat_taps + 1 WHERE id = $1 AND status = 'active'")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if done.rows_affected() > 0 {
        let buyer_id = viewer.as_ref().map(|u| u.id.clone());
        let buyer_name = viewer.as_ref().map(|u| u.name.clone()).unwrap_or_default();
        models::record_chat_sale(&state.db, &id, buyer_id.as_deref(), &buyer_name).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn categories(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', id, 'slug', slug, 'name', name, 'icon', icon, 'imageUrl', image_url, 'order', sort_order) FROM categories ORDER BY sort_order, name",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(Value::Array(items)))
}

pub async fn feed(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let cfg = models::settings(&state.db).await?;
    let on = |key: &str| cfg[key].as_bool().unwrap_or(true);

    let mut products: Vec<Value> = Vec::new();
    let mut sales: Vec<Value> = Vec::new();
    let mut notes: Vec<Value> = Vec::new();

    if on("showLiveProducts") {
        products = sqlx::query_scalar::<_, Value>(
            "SELECT jsonb_build_object('kind', 'product', 'id', l.id, 'title', l.title, 'price', l.price, 'image', l.images->0, 'link', '/product/' || l.id) FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.status = 'active' AND u.status = 'active' ORDER BY l.created_at DESC LIMIT 10",
        )
        .fetch_all(&state.db)
        .await?;
    }
    if on("showRecentSales") {
        sales = sqlx::query_scalar::<_, Value>(
            "SELECT jsonb_build_object('kind', 'sale', 'id', id, 'title', title, 'price', price, 'at', created_at) FROM sales ORDER BY created_at DESC LIMIT 6",
        )
        .fetch_all(&state.db)
        .await?;
    }
    if on("showAdminMessages") {
        notes = sqlx::query_scalar::<_, Value>(
            "SELECT jsonb_build_object('kind', 'admin', 'id', id, 'text', text, 'link', link) FROM ticker_messages WHERE active ORDER BY sort_order, created_at DESC LIMIT 10",
        )
        .fetch_all(&state.db)
        .await?;
    }

    let longest = products.len().max(sales.len()).max(notes.len());
    let mut items: Vec<Value> = Vec::new();
    for i in 0..longest {
        if let Some(v) = products.get(i) {
            items.push(v.clone());
        }
        if let Some(v) = notes.get(i) {
            items.push(v.clone());
        }
        if let Some(v) = sales.get(i) {
            items.push(v.clone());
        }
    }
    Ok(Json(json!({ "items": items })))
}

pub async fn recent_sales(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', s.id, 'title', s.title, 'price', s.price, 'sellerName', split_part(u.full_name, ' ', 1) || ' ' || left(split_part(u.full_name, ' ', 2), 1), 'buyerName', s.buyer_name, 'at', s.created_at) FROM sales s JOIN users u ON u.id = s.seller_id ORDER BY s.created_at DESC LIMIT 10",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn ads(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let cfg = models::settings(&state.db).await?;
    if cfg["showAds"].as_bool() == Some(false) {
        return Ok(Json(json!({ "items": [] })));
    }
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', id, 'tag', tag, 'title', title, 'body', body, 'buttonText', button_text, 'link', link, 'bg', bg, 'imageUrl', image_url, 'layout', layout) FROM ads WHERE active ORDER BY sort_order, created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn settings(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(models::settings(&state.db).await?))
}

pub async fn stats(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let row = sqlx::query_as::<_, (i64, i64, i64)>(
        "SELECT (SELECT count(*) FROM users WHERE status = 'active'), (SELECT count(*) FROM listings WHERE status = 'active'), (SELECT count(DISTINCT seller_id) FROM listings WHERE status = 'active')",
    )
    .fetch_one(&state.db)
    .await?;
    Ok(Json(json!({ "users": row.0, "listings": row.1, "sellers": row.2 })))
}

pub async fn public_user(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<Json<Value>> {
    let sql = format!(
        "SELECT {} FROM users u WHERE u.id = $1 AND u.status = 'active'",
        models::PUBLIC_USER_JSON
    );
    let user = sqlx::query_scalar::<_, Value>(&sql)
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("Seller not found."))?;
    Ok(Json(user))
}

pub async fn user_reviews(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<Json<Value>> {
    let items = sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'createdAt', r.created_at, 'reviewer', jsonb_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url)) FROM reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.seller_id = $1 ORDER BY r.created_at DESC LIMIT 100",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;
    let (count, rating) = sqlx::query_as::<_, (i64, f64)>(
        "SELECT count(*), COALESCE(avg(rating), 0)::float8 FROM reviews WHERE seller_id = $1",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(json!({ "items": items, "count": count, "rating": rating })))
}
