mod auth;
mod config;
mod error;
mod models;
mod routes;
mod security;
mod state;

use std::{net::SocketAddr, sync::Arc, time::Duration};

use axum::{
    extract::DefaultBodyLimit,
    middleware,
    http::{
        header::{AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, Method,
    },
};
use sqlx::{postgres::PgPoolOptions, Executor};
use tokio::sync::RwLock;
use tower_http::{
    cors::{Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;

use crate::{
    config::Config,
    state::{AppState, KeyCache},
};

fn cors(cfg: &Config) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE])
        .max_age(Duration::from_secs(3600));
    if cfg.cors_origins.is_empty() {
        base.allow_origin(Any)
    } else {
        let origins: Vec<HeaderValue> = cfg.cors_origins.iter().filter_map(|o| o.parse().ok()).collect();
        base.allow_origin(origins)
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/.env"));
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let cfg = Arc::new(Config::from_env()?);

    let db = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(15))
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                conn.execute("SET search_path TO lm, public").await?;
                Ok(())
            })
        })
        .connect(&cfg.database_url)
        .await?;

    sqlx::query("CREATE SCHEMA IF NOT EXISTS lm").execute(&db).await?;
    for statement in include_str!("../migrations/0001_init.sql")
        .split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        sqlx::query(statement).execute(&db).await?;
    }
    tracing::info!("database ready");

    let state = AppState {
        db,
        cfg: cfg.clone(),
        keys: Arc::new(RwLock::new(KeyCache {
            keys: Default::default(),
            fetched: None,
        })),
    };

    let limiter = security::Limiter::new(cfg.trust_proxy);
    let app = routes::router()
        .with_state(state)
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(TimeoutLayer::new(Duration::from_secs(20)))
        .layer(middleware::from_fn_with_state(limiter, security::rate_limit))
        .layer(middleware::from_fn(security::secure_headers))
        .layer(cors(&cfg))
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", cfg.port)).await?;
    tracing::info!("Ludek Market API listening on port {}", cfg.port);
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;
    Ok(())
}
