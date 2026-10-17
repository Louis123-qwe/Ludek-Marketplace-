use serde_json::{json, Value};
use sqlx::PgPool;

use crate::{
    config::Config,
    error::{AppError, AppResult},
};

pub const USER_JSON: &str = "jsonb_build_object('id', u.id, 'email', u.email, 'fullName', u.full_name, 'storeName', u.store_name, 'bio', u.bio, 'whatsapp', u.whatsapp, 'instagram', u.instagram, 'department', u.department, 'level', u.level, 'avatarUrl', u.avatar_url, 'bannerUrl', u.banner_url, 'role', u.role, 'status', u.status, 'verified', u.verified, 'rating', u.rating, 'ratingCount', u.rating_count, 'createdAt', u.created_at)";

pub const PUBLIC_USER_JSON: &str = "jsonb_build_object('id', u.id, 'fullName', u.full_name, 'storeName', u.store_name, 'bio', u.bio, 'whatsapp', u.whatsapp, 'instagram', u.instagram, 'department', u.department, 'level', u.level, 'avatarUrl', u.avatar_url, 'bannerUrl', u.banner_url, 'role', u.role, 'verified', u.verified, 'rating', u.rating, 'ratingCount', u.rating_count, 'createdAt', u.created_at, 'listingCount', (SELECT count(*) FROM listings x WHERE x.seller_id = u.id AND x.status = 'active'))";

pub const LISTING_JSON: &str = "jsonb_build_object('id', l.id, 'sellerId', l.seller_id, 'title', l.title, 'description', l.description, 'price', l.price, 'category', l.category, 'condition', l.condition, 'negotiable', l.negotiable, 'whatsapp', l.whatsapp, 'location', l.location, 'images', l.images, 'status', l.status, 'featured', l.featured, 'views', l.views, 'chatTaps', l.chat_taps, 'createdAt', l.created_at, 'updatedAt', l.updated_at, 'seller', jsonb_build_object('id', u.id, 'fullName', u.full_name, 'storeName', u.store_name, 'avatarUrl', u.avatar_url, 'verified', u.verified, 'rating', u.rating, 'ratingCount', u.rating_count, 'whatsapp', u.whatsapp, 'status', u.status))";

pub const LISTING_FROM: &str = "listings l JOIN users u ON u.id = l.seller_id";

pub fn clean(value: &str, max: usize) -> String {
    value.trim().chars().take(max).collect()
}

pub fn opt_clean(value: Option<String>, max: usize) -> Option<String> {
    value.map(|v| clean(&v, max))
}

pub fn nz(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn page_args(page: Option<i64>, limit: Option<i64>, default: i64, max: i64) -> (i64, i64, i64) {
    let page = page.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(default).clamp(1, max);
    (page, limit, (page - 1) * limit)
}

pub fn page_json(items: Vec<Value>, total: i64, page: i64, limit: i64) -> Value {
    let pages = ((total + limit - 1) / limit).max(1);
    json!({ "items": items, "total": total, "page": page, "pages": pages })
}

pub fn slugify(value: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for ch in value.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    out.trim_end_matches('-').to_string()
}

pub fn normalize_phone(value: &str) -> String {
    let digits: String = value.chars().filter(|c| c.is_ascii_digit()).collect();
    if let Some(rest) = digits.strip_prefix('0') {
        format!("234{}", rest)
    } else if digits.len() == 10 {
        format!("234{}", digits)
    } else {
        digits
    }
}

pub fn valid_phone(value: &str) -> bool {
    let n = normalize_phone(value);
    n.len() == 13 && n.starts_with("234") && matches!(n.as_bytes()[3], b'7' | b'8' | b'9')
}

pub fn safe_link(value: &str) -> bool {
    value.is_empty() || (value.starts_with('/') && !value.starts_with("//")) || value.starts_with("https://")
}

pub fn ad_bg_ok(value: &str) -> bool {
    matches!(value, "forest" | "pale" | "white" | "orange" | "gold" | "sky" | "rose" | "night")
        || (value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit()))
}

pub fn image_url_ok(cfg: &Config, url: &str) -> bool {
    match &cfg.cloudinary_cloud_name {
        Some(cloud) => url.starts_with(&format!("https://res.cloudinary.com/{}/", cloud)),
        None => url.starts_with("https://"),
    }
}

pub async fn settings(db: &PgPool) -> AppResult<Value> {
    let mut merged = json!({
        "requireApproval": false,
        "allowSignups": true,
        "maintenance": false,
        "showLiveProducts": true,
        "showRecentSales": true,
        "showAdminMessages": true,
        "showAds": true,
        "supportEmail": "",
        "supportWhatsapp": ""
    });
    let stored = sqlx::query_scalar::<_, Value>("SELECT value FROM settings WHERE key = 'platform'")
        .fetch_optional(db)
        .await?;
    if let (Some(Value::Object(saved)), Some(base)) = (stored, merged.as_object_mut()) {
        for (key, value) in saved {
            if base.contains_key(&key) {
                base.insert(key, value);
            }
        }
    }
    Ok(merged)
}

pub async fn user_json(db: &PgPool, id: &str) -> AppResult<Value> {
    let sql = format!("SELECT {} FROM users u WHERE u.id = $1", USER_JSON);
    sqlx::query_scalar::<_, Value>(&sql)
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))
}

pub async fn listing_json(db: &PgPool, id: &str) -> AppResult<Value> {
    let sql = format!("SELECT {} FROM {} WHERE l.id = $1", LISTING_JSON, LISTING_FROM);
    sqlx::query_scalar::<_, Value>(&sql)
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::not_found("Listing not found."))
}

pub async fn audit(db: &PgPool, kind: &str, actor: &str, action: &str, target: &str) {
    let _ = sqlx::query("INSERT INTO audit_logs (kind, actor, action, target) VALUES ($1, $2, $3, $4)")
        .bind(kind)
        .bind(actor)
        .bind(action)
        .bind(target)
        .execute(db)
        .await;
}

pub async fn notify_user(db: &PgPool, user_id: &str, title: &str, message: &str, link: &str) {
    let _ = sqlx::query("INSERT INTO notifications (user_id, title, message, link) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(title)
        .bind(message)
        .bind(link)
        .execute(db)
        .await;
}

pub async fn notify_admins(db: &PgPool, title: &str, message: &str, link: &str) {
    let _ = sqlx::query(
        "INSERT INTO notifications (user_id, title, message, link) SELECT id, $1, $2, $3 FROM users WHERE role = 'admin' AND status = 'active'",
    )
    .bind(title)
    .bind(message)
    .bind(link)
    .execute(db)
    .await;
}

pub async fn record_sale(db: &PgPool, listing_id: &str, buyer: &str) -> AppResult<()> {
    let row = sqlx::query_as::<_, (String, i64, String, String)>(
        "SELECT l.title, l.price, l.seller_id, u.full_name FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = $1",
    )
    .bind(listing_id)
    .fetch_optional(db)
    .await?;
    if let Some((title, price, seller_id, seller_name)) = row {
        sqlx::query("INSERT INTO sales (listing_id, seller_id, title, price, buyer_name) VALUES ($1, $2, $3, $4, $5)")
            .bind(listing_id)
            .bind(&seller_id)
            .bind(&title)
            .bind(price)
            .bind(buyer)
            .execute(db)
            .await?;
        let target = format!("{} for N{}", title, price);
        audit(db, "sale", &seller_name, "Sale recorded", &target).await;
    }
    Ok(())
}

fn short_name(name: &str) -> String {
    let mut parts = name.split_whitespace();
    match (parts.next(), parts.next()) {
        (Some(first), Some(second)) => format!("{} {}.", first, second.chars().next().unwrap_or(' ')),
        (Some(first), None) => first.to_string(),
        _ => String::new(),
    }
}

/// Payments happen off-site, so a buyer opening the WhatsApp chat is recorded as a sale.
pub async fn record_chat_sale(db: &PgPool, listing_id: &str, buyer_id: Option<&str>, buyer_name: &str) -> AppResult<()> {
    let row = sqlx::query_as::<_, (String, i64, String)>("SELECT title, price, seller_id FROM listings WHERE id = $1")
        .bind(listing_id)
        .fetch_optional(db)
        .await?;
    let Some((title, price, seller_id)) = row else {
        return Ok(());
    };
    if buyer_id == Some(seller_id.as_str()) {
        return Ok(());
    }
    let duplicate = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM sales WHERE listing_id = $1 AND source = 'chat' AND ((($2::text IS NOT NULL) AND buyer_id = $2::text AND created_at > now() - interval '24 hours') OR (($2::text IS NULL) AND buyer_id IS NULL AND created_at > now() - interval '1 hour')))",
    )
    .bind(listing_id)
    .bind(buyer_id)
    .fetch_one(db)
    .await?;
    if duplicate {
        return Ok(());
    }
    let buyer = short_name(buyer_name);
    sqlx::query("INSERT INTO sales (listing_id, seller_id, title, price, buyer_name, buyer_id, source) VALUES ($1, $2, $3, $4, $5, $6, 'chat')")
        .bind(listing_id)
        .bind(&seller_id)
        .bind(&title)
        .bind(price)
        .bind(&buyer)
        .bind(buyer_id)
        .execute(db)
        .await?;
    let actor = if buyer.is_empty() { "Visitor".to_string() } else { buyer };
    audit(db, "sale", &actor, "Chat opened, sale recorded", &format!("{} for N{}", title, price)).await;
    Ok(())
}
