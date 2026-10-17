use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderName, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Clone)]
pub struct Limiter {
    windows: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
    trust_proxy: bool,
}

impl Limiter {
    pub fn new(trust_proxy: bool) -> Self {
        Self {
            windows: Arc::new(Mutex::new(HashMap::new())),
            trust_proxy,
        }
    }

    fn check(&self, key: String, limit: u32, window: Duration) -> Result<(), u64> {
        let mut map = match self.windows.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        let now = Instant::now();
        if map.len() > 20_000 {
            map.retain(|_, (_, start)| now.duration_since(*start) < Duration::from_secs(120));
        }
        let entry = map.entry(key).or_insert((0, now));
        if now.duration_since(entry.1) >= window {
            *entry = (0, now);
        }
        if entry.0 >= limit {
            let wait = window.saturating_sub(now.duration_since(entry.1)).as_secs().max(1);
            return Err(wait);
        }
        entry.0 += 1;
        Ok(())
    }
}

fn client_ip(req: &Request, trust_proxy: bool) -> String {
    if trust_proxy {
        if let Some(value) = req.headers().get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            if let Some(last) = value.rsplit(',').next() {
                let ip = last.trim();
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }
    req.extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|info| info.0.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub async fn rate_limit(State(limiter): State<Limiter>, req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    if path == "/health" {
        return next.run(req).await;
    }
    let method = req.method().clone();
    let ip = client_ip(&req, limiter.trust_proxy);

    let (tier, limit) = if path == "/api/me/sync" || path == "/api/uploads/sign" || path == "/api/reports" {
        ("hot", 30)
    } else if path.starts_with("/api/admin") {
        ("admin", 120)
    } else if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        ("read", 240)
    } else {
        ("write", 60)
    };

    match limiter.check(format!("{}:{}", ip, tier), limit, Duration::from_secs(60)) {
        Ok(()) => next.run(req).await,
        Err(wait) => {
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({ "error": "Too many requests. Slow down and try again shortly." })),
            )
                .into_response();
            response.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(wait));
            response
        }
    }
}

pub async fn secure_headers(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    let private = path.starts_with("/api/me") || path.starts_with("/api/admin") || path.starts_with("/api/favorites");
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        header::STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=63072000; includeSubDomains; preload"),
    );
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers.insert(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer"));
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'"),
    );
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
    );
    if private {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    }
    response
}
