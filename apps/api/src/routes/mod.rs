use axum::{
    routing::{get, patch, post, put},
    Router,
};

use crate::state::AppState;

mod admin;
mod listings;
mod me;
mod public;
mod social;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/listings", get(public::list_listings).post(listings::create_listing))
        .route(
            "/api/listings/:id",
            get(public::get_listing)
                .patch(listings::update_listing)
                .delete(listings::delete_listing),
        )
        .route("/api/listings/:id/view", post(public::track_view))
        .route("/api/listings/:id/chat-tap", post(public::track_chat))
        .route("/api/categories", get(public::categories))
        .route("/api/feed", get(public::feed))
        .route("/api/sales/recent", get(public::recent_sales))
        .route("/api/ads", get(public::ads))
        .route("/api/settings", get(public::settings))
        .route("/api/stats", get(public::stats))
        .route("/api/users/:id", get(public::public_user))
        .route(
            "/api/users/:id/reviews",
            get(public::user_reviews).post(social::add_review),
        )
        .route("/api/me", get(me::get_me).patch(me::patch_me))
        .route("/api/me/sync", post(me::sync))
        .route("/api/me/stats", get(me::stats))
        .route("/api/me/listings", get(me::listings))
        .route("/api/me/notifications", get(me::notifications))
        .route("/api/me/notifications/unread", get(me::unread))
        .route("/api/me/notifications/read", post(me::mark_read))
        .route("/api/me/favorites", get(me::favorites))
        .route("/api/me/favorites/ids", get(me::favorite_ids))
        .route(
            "/api/favorites/:id",
            put(me::add_favorite).delete(me::remove_favorite),
        )
        .route("/api/reports", post(social::create_report))
        .route("/api/uploads/sign", post(social::upload_config))
        .route("/api/admin/overview", get(admin::overview))
        .route("/api/admin/users", get(admin::list_users))
        .route("/api/admin/users/:id", patch(admin::patch_user))
        .route("/api/admin/listings", get(admin::list_listings))
        .route(
            "/api/admin/listings/:id",
            patch(admin::patch_listing).delete(admin::delete_listing),
        )
        .route("/api/admin/categories", post(admin::create_category))
        .route(
            "/api/admin/categories/:id",
            patch(admin::update_category).delete(admin::delete_category),
        )
        .route("/api/admin/reports", get(admin::list_reports))
        .route("/api/admin/reports/:id", patch(admin::patch_report))
        .route(
            "/api/admin/announcements",
            get(admin::list_announcements).post(admin::create_announcement),
        )
        .route("/api/admin/announcements/:id", axum::routing::delete(admin::delete_announcement))
        .route("/api/admin/notifications", post(admin::notify_member))
        .route("/api/admin/ticker", get(admin::list_ticker).post(admin::create_ticker))
        .route(
            "/api/admin/ticker/:id",
            patch(admin::update_ticker).delete(admin::delete_ticker),
        )
        .route("/api/admin/sales", get(admin::sales))
        .route("/api/admin/ads", get(admin::list_ads).post(admin::create_ad))
        .route("/api/admin/ads/:id", patch(admin::update_ad).delete(admin::delete_ad))
        .route("/api/admin/settings", get(admin::get_settings).put(admin::put_settings))
        .route("/api/admin/logs", get(admin::logs))
}
