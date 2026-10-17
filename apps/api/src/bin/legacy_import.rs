use std::collections::HashSet;
use std::time::Duration;

use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, Executor, PgPool};

fn flatten(row: Value) -> Value {
    let mut map = match row {
        Value::Object(m) => m,
        other => return other,
    };
    for nested in ["data", "doc", "fields"] {
        if let Some(Value::Object(inner)) = map.get(nested).cloned() {
            for (key, value) in inner {
                map.entry(key).or_insert(value);
            }
        }
    }
    Value::Object(map)
}

fn pick<'a>(row: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|key| row.get(*key).filter(|v| !v.is_null()))
}

fn text(row: &Value, keys: &[&str]) -> String {
    match pick(row, keys) {
        Some(Value::String(s)) => s.trim().to_string(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

fn number(row: &Value, keys: &[&str]) -> Option<f64> {
    match pick(row, keys) {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => {
            let digits: String = s.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
            digits.parse().ok()
        }
        _ => None,
    }
}

fn boolean(row: &Value, keys: &[&str]) -> bool {
    matches!(pick(row, keys), Some(Value::Bool(true)))
}

fn time(row: &Value, keys: &[&str]) -> (Option<String>, Option<f64>) {
    match pick(row, keys) {
        Some(Value::String(s)) => (Some(s.clone()), None),
        Some(Value::Number(n)) => {
            let v = n.as_f64().map(|x| if x > 1e11 { x / 1000.0 } else { x });
            (None, v)
        }
        Some(Value::Object(o)) => {
            let secs = o.get("seconds").or_else(|| o.get("_seconds")).and_then(|v| v.as_f64());
            (None, secs)
        }
        _ => (None, None),
    }
}

fn images(row: &Value) -> Vec<String> {
    let keys = ["images", "imageUrls", "image_urls", "photos", "photoUrls", "imageUrl", "image"];
    let mut out: Vec<String> = Vec::new();
    match pick(row, &keys) {
        Some(Value::Array(items)) => {
            for item in items {
                match item {
                    Value::String(s) => out.push(s.clone()),
                    Value::Object(o) => {
                        if let Some(Value::String(s)) = o.get("url").or_else(|| o.get("secure_url")) {
                            out.push(s.clone());
                        }
                    }
                    _ => {}
                }
            }
        }
        Some(Value::String(s)) => out.push(s.clone()),
        _ => {}
    }
    out.into_iter().filter(|u| u.starts_with("http")).collect()
}

fn slugify(value: &str) -> String {
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

async fn legacy_rows(db: &PgPool, table: &str) -> Vec<Value> {
    let sql = format!("SELECT to_jsonb(t) FROM public.\"{}\" t", table);
    match sqlx::query_scalar::<_, Value>(&sql).fetch_all(db).await {
        Ok(rows) => rows.into_iter().map(flatten).collect(),
        Err(err) => {
            println!("skipped table {}: {}", table, err);
            Vec::new()
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/.env"));
    let _ = dotenvy::dotenv();
    let url = std::env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("DATABASE_URL is not set in .env"))?;
    let db = PgPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(Duration::from_secs(15))
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                conn.execute("SET search_path TO lm, public").await?;
                Ok(())
            })
        })
        .connect(&url)
        .await?;

    sqlx::query("CREATE SCHEMA IF NOT EXISTS lm").execute(&db).await?;
    for statement in include_str!("../../migrations/0001_init.sql")
        .split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        sqlx::query(statement).execute(&db).await?;
    }

    let mut users_done = 0;
    for row in legacy_rows(&db, "users").await {
        let id = text(&row, &["id", "uid", "userId", "_id"]);
        if id.is_empty() {
            continue;
        }
        let mut full_name = text(&row, &["fullName", "full_name", "displayName", "display_name", "name"]);
        if full_name.is_empty() {
            full_name = format!("{} {}", text(&row, &["firstName", "first_name"]), text(&row, &["lastName", "last_name"]))
                .trim()
                .to_string();
        }
        let role = match text(&row, &["role", "userType", "accountType"]).to_lowercase().as_str() {
            "admin" => "admin",
            "seller" | "vendor" | "business" => "seller",
            _ => "customer",
        };
        let status_text = text(&row, &["status"]).to_lowercase();
        let suspended = matches!(status_text.as_str(), "suspended" | "banned" | "blocked" | "disabled")
            || boolean(&row, &["suspended", "banned"]);
        let (created_text, created_secs) = time(&row, &["createdAt", "created_at", "joinedAt"]);
        let result = sqlx::query(
            "INSERT INTO users (id, email, full_name, store_name, bio, whatsapp, instagram, department, level, avatar_url, banner_url, role, status, verified, rating, rating_count, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE($17::timestamptz, to_timestamp($18::double precision), now())) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&id)
        .bind(text(&row, &["email"]).to_lowercase())
        .bind(&full_name)
        .bind(text(&row, &["storeName", "store_name", "businessName"]))
        .bind(text(&row, &["bio", "about"]))
        .bind(text(&row, &["whatsapp", "whatsappNumber", "phone", "phoneNumber"]))
        .bind(text(&row, &["instagram"]))
        .bind(text(&row, &["department"]))
        .bind(text(&row, &["level"]))
        .bind(text(&row, &["avatarUrl", "avatar_url", "photoURL", "photoUrl", "profilePic", "avatar"]))
        .bind(text(&row, &["bannerUrl", "banner_url", "banner"]))
        .bind(role)
        .bind(if suspended { "suspended" } else { "active" })
        .bind(boolean(&row, &["verified", "isVerified", "is_verified"]))
        .bind(number(&row, &["rating", "avgRating"]).unwrap_or(0.0))
        .bind(number(&row, &["ratingCount", "rating_count", "reviewCount"]).unwrap_or(0.0) as i32)
        .bind(created_text)
        .bind(created_secs)
        .execute(&db)
        .await;
        match result {
            Ok(done) => users_done += done.rows_affected(),
            Err(err) => println!("user {} skipped: {}", id, err),
        }
    }

    let known: HashSet<String> = sqlx::query_scalar::<_, String>("SELECT id FROM users")
        .fetch_all(&db)
        .await?
        .into_iter()
        .collect();

    let mut listings_done = 0;
    let mut listings_skipped = 0;
    for row in legacy_rows(&db, "listings").await {
        let id = text(&row, &["id", "listingId", "_id"]);
        let seller = text(&row, &["sellerId", "seller_id", "vendorId", "userId", "uid"]);
        let title = text(&row, &["title", "name"]);
        if id.is_empty() || title.is_empty() || !known.contains(&seller) {
            listings_skipped += 1;
            continue;
        }
        let status_text = text(&row, &["status"]).to_lowercase();
        let status = match status_text.as_str() {
            "sold" => "sold",
            "pending" | "pending_review" => "pending",
            "draft" | "inactive" | "deleted" | "removed" | "rejected" => "draft",
            _ => {
                if boolean(&row, &["sold"]) {
                    "sold"
                } else {
                    "active"
                }
            }
        };
        let condition_text = text(&row, &["condition"]);
        let condition = if ["new", "like-new", "used-good", "used-fair", "service"].contains(&condition_text.as_str()) {
            condition_text
        } else {
            "used-good".to_string()
        };
        let mut category = slugify(&text(&row, &["category", "categoryId"]));
        if category.is_empty() {
            category = "other".to_string();
        }
        let (created_text, created_secs) = time(&row, &["createdAt", "created_at", "postedAt"]);
        let pics = images(&row);
        let result = sqlx::query(
            "INSERT INTO listings (id, seller_id, title, description, price, category, condition, negotiable, whatsapp, location, images, status, featured, views, chat_taps, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16::timestamptz, to_timestamp($17::double precision), now())) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&id)
        .bind(&seller)
        .bind(&title)
        .bind(text(&row, &["description", "details"]))
        .bind(number(&row, &["price", "amount"]).unwrap_or(0.0).round() as i64)
        .bind(&category)
        .bind(&condition)
        .bind(boolean(&row, &["negotiable", "isNegotiable"]))
        .bind(text(&row, &["whatsapp", "whatsappNumber", "phone"]))
        .bind(text(&row, &["location", "pickupLocation"]))
        .bind(serde_json::json!(pics))
        .bind(status)
        .bind(boolean(&row, &["featured", "isFeatured"]))
        .bind(number(&row, &["views", "viewCount"]).unwrap_or(0.0) as i64)
        .bind(number(&row, &["chatTaps", "chat_taps", "whatsappTaps"]).unwrap_or(0.0) as i64)
        .bind(created_text)
        .bind(created_secs)
        .execute(&db)
        .await;
        match result {
            Ok(done) => listings_done += done.rows_affected(),
            Err(err) => {
                listings_skipped += 1;
                println!("listing {} skipped: {}", id, err);
            }
        }
    }

    let mut categories_done = 0;
    for row in legacy_rows(&db, "categories").await {
        let name = text(&row, &["name", "label", "title"]);
        if name.is_empty() {
            continue;
        }
        let mut slug = slugify(&text(&row, &["slug", "value", "id"]));
        if slug.is_empty() {
            slug = slugify(&name);
        }
        let result = sqlx::query("INSERT INTO categories (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING")
            .bind(&slug)
            .bind(&name)
            .execute(&db)
            .await;
        if let Ok(done) = result {
            categories_done += done.rows_affected();
        }
    }

    println!(
        "Imported {} users, {} listings ({} skipped), {} categories",
        users_done, listings_done, listings_skipped, categories_done
    );
    Ok(())
}
