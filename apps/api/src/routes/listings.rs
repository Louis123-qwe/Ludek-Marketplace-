use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult},
    models,
    state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListingBody {
    title: Option<String>,
    description: Option<String>,
    price: Option<f64>,
    category: Option<String>,
    condition: Option<String>,
    negotiable: Option<bool>,
    whatsapp: Option<String>,
    location: Option<String>,
    images: Option<Vec<String>>,
    status: Option<String>,
    buyer_name: Option<String>,
}

const CONDITIONS: [&str; 5] = ["new", "like-new", "used-good", "used-fair", "service"];

fn parse_price(value: f64) -> AppResult<i64> {
    if !value.is_finite() || value < 0.0 || value > 1_000_000_000.0 {
        return Err(AppError::bad("Enter a valid price."));
    }
    Ok(value.round() as i64)
}

fn check_images(state: &AppState, images: &[String]) -> AppResult<()> {
    if images.len() > 6 {
        return Err(AppError::bad("You can add up to 6 photos."));
    }
    for url in images {
        if !models::image_url_ok(&state.cfg, url) {
            return Err(AppError::bad("Photos must be uploaded through Ludek Market."));
        }
    }
    Ok(())
}

pub async fn create_listing(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ListingBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let title = models::clean(body.title.as_deref().unwrap_or(""), 80);
    if title.chars().count() < 4 {
        return Err(AppError::bad("Add a title of at least 4 characters."));
    }
    let category = models::slugify(body.category.as_deref().unwrap_or(""));
    if category.is_empty() {
        return Err(AppError::bad("Choose a category."));
    }
    let price = parse_price(body.price.unwrap_or(-1.0))?;
    let status_in = body.status.as_deref().unwrap_or("active").to_string();
    if status_in != "active" && status_in != "draft" {
        return Err(AppError::bad("Status must be active or draft."));
    }
    let description = models::clean(body.description.as_deref().unwrap_or(""), 1500);
    let images = body.images.unwrap_or_default();
    check_images(&state, &images)?;
    let location = models::clean(body.location.as_deref().unwrap_or(""), 60);
    let mut whatsapp = models::clean(body.whatsapp.as_deref().unwrap_or(""), 20);
    if whatsapp.is_empty() {
        whatsapp = sqlx::query_scalar::<_, String>("SELECT whatsapp FROM users WHERE id = $1")
            .bind(&user.id)
            .fetch_one(&state.db)
            .await?;
    }
    let condition = body
        .condition
        .as_deref()
        .filter(|c| CONDITIONS.contains(c))
        .unwrap_or("used-good")
        .to_string();

    if status_in == "active" {
        if description.chars().count() < 10 {
            return Err(AppError::bad("Add a description of at least 10 characters."));
        }
        if images.is_empty() {
            return Err(AppError::bad("Add at least one photo."));
        }
        if !models::valid_phone(&whatsapp) {
            return Err(AppError::bad("Enter a valid Nigerian WhatsApp number."));
        }
    } else if !whatsapp.is_empty() && !models::valid_phone(&whatsapp) {
        return Err(AppError::bad("Enter a valid Nigerian WhatsApp number."));
    }

    let open = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM listings WHERE seller_id = $1 AND status <> 'sold'")
        .bind(&user.id)
        .fetch_one(&state.db)
        .await?;
    if open >= 100 {
        return Err(AppError::bad("You have reached the listing limit. Remove or sell some items first."));
    }

    let settings = models::settings(&state.db).await?;
    let needs_review = settings["requireApproval"].as_bool().unwrap_or(false) && !user.is_admin();
    let status = if status_in == "active" && needs_review { "pending" } else { status_in.as_str() };

    sqlx::query("UPDATE users SET role = 'seller' WHERE id = $1 AND role = 'customer'")
        .bind(&user.id)
        .execute(&state.db)
        .await?;

    let id = sqlx::query_scalar::<_, String>(
        "INSERT INTO listings (seller_id, title, description, price, category, condition, negotiable, whatsapp, location, images, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
    )
    .bind(&user.id)
    .bind(&title)
    .bind(&description)
    .bind(price)
    .bind(&category)
    .bind(&condition)
    .bind(body.negotiable.unwrap_or(false))
    .bind(&whatsapp)
    .bind(&location)
    .bind(json!(images))
    .bind(status)
    .fetch_one(&state.db)
    .await?;

    if status == "pending" {
        models::notify_admins(
            &state.db,
            "Listing awaiting review",
            &format!("{} by {}", title, user.name),
            "/admin/listings",
        )
        .await;
    }

    let listing = models::listing_json(&state.db, &id).await?;
    Ok((StatusCode::CREATED, Json(listing)))
}

pub async fn update_listing(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ListingBody>,
) -> AppResult<Json<Value>> {
    let row = sqlx::query(
        "SELECT seller_id, status, description, whatsapp, jsonb_array_length(images)::bigint AS image_count FROM listings WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::not_found("Listing not found."))?;
    let seller_id: String = row.try_get("seller_id")?;
    let current: String = row.try_get("status")?;
    let old_description: String = row.try_get("description")?;
    let old_whatsapp: String = row.try_get("whatsapp")?;
    let old_images: i64 = row.try_get("image_count")?;

    if seller_id != user.id && !user.is_admin() {
        return Err(AppError::forbidden("This is not your listing."));
    }

    let title = models::opt_clean(body.title, 80);
    if let Some(t) = &title {
        if t.chars().count() < 4 {
            return Err(AppError::bad("Add a title of at least 4 characters."));
        }
    }
    let category = body.category.map(|c| models::slugify(&c));
    if let Some(c) = &category {
        if c.is_empty() {
            return Err(AppError::bad("Choose a category."));
        }
    }
    let price = match body.price {
        Some(p) => Some(parse_price(p)?),
        None => None,
    };
    let description = models::opt_clean(body.description, 1500);
    let location = models::opt_clean(body.location, 60);
    let whatsapp = models::opt_clean(body.whatsapp, 20);
    let condition = body
        .condition
        .filter(|c| CONDITIONS.contains(&c.as_str()));
    if let Some(images) = &body.images {
        check_images(&state, images)?;
    }

    let mut target_status: Option<String> = None;
    if let Some(requested) = body.status.as_deref() {
        if !["active", "sold", "draft"].contains(&requested) {
            return Err(AppError::bad("Status must be active, sold or draft."));
        }
        let settings = models::settings(&state.db).await?;
        let needs_review = settings["requireApproval"].as_bool().unwrap_or(false) && !user.is_admin();
        let resolved = if requested == "active" && current == "pending" && !user.is_admin() {
            "pending"
        } else if requested == "active" && needs_review && current == "draft" {
            "pending"
        } else {
            requested
        };
        target_status = Some(resolved.to_string());
    }

    let final_status = target_status.clone().unwrap_or_else(|| current.clone());
    if final_status == "active" || final_status == "pending" {
        let desc_len = description.as_deref().unwrap_or(old_description.as_str()).chars().count();
        let phone = whatsapp.as_deref().unwrap_or(old_whatsapp.as_str());
        let image_count = body.images.as_ref().map(|i| i.len() as i64).unwrap_or(old_images);
        if desc_len < 10 {
            return Err(AppError::bad("Add a description of at least 10 characters."));
        }
        if image_count < 1 {
            return Err(AppError::bad("Add at least one photo."));
        }
        if !models::valid_phone(phone) {
            return Err(AppError::bad("Enter a valid Nigerian WhatsApp number."));
        }
    }

    sqlx::query(
        "UPDATE listings SET title = COALESCE($2::text, title), description = COALESCE($3::text, description), price = COALESCE($4::bigint, price), category = COALESCE($5::text, category), condition = COALESCE($6::text, condition), negotiable = COALESCE($7::boolean, negotiable), whatsapp = COALESCE($8::text, whatsapp), location = COALESCE($9::text, location), images = COALESCE($10::jsonb, images), status = COALESCE($11::text, status), updated_at = now() WHERE id = $1",
    )
    .bind(&id)
    .bind(title)
    .bind(description)
    .bind(price)
    .bind(category)
    .bind(condition)
    .bind(body.negotiable)
    .bind(whatsapp)
    .bind(location)
    .bind(body.images.map(|i| json!(i)))
    .bind(target_status)
    .execute(&state.db)
    .await?;

    if final_status == "sold" && current != "sold" {
        let buyer = models::clean(body.buyer_name.as_deref().unwrap_or(""), 60);
        models::record_sale(&state.db, &id, &buyer).await?;
    }

    Ok(Json(models::listing_json(&state.db, &id).await?))
}

pub async fn delete_listing(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let seller_id = sqlx::query_scalar::<_, String>("SELECT seller_id FROM listings WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("Listing not found."))?;
    if seller_id != user.id && !user.is_admin() {
        return Err(AppError::forbidden("This is not your listing."));
    }
    sqlx::query("DELETE FROM listings WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if seller_id != user.id {
        models::audit(&state.db, "admin", &user.name, "Listing deleted", &id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}
