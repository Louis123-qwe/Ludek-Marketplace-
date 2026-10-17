use std::{
    collections::HashMap,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use axum::{async_trait, extract::FromRequestParts, http::header::AUTHORIZATION, http::request::Parts};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rsa::{BigUint, Pkcs1v15Sign, RsaPublicKey};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::Row;

use crate::{error::AppError, state::AppState};

const JWKS_URL: &str = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

pub struct Claims {
    pub uid: String,
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
}

fn unauthorized() -> AppError {
    AppError::Unauthorized("Please sign in again.".to_string())
}

async fn refresh_keys(state: &AppState) -> Result<(), AppError> {
    let body = tokio::task::spawn_blocking(|| -> Result<String, String> {
        let response = ureq::get(JWKS_URL)
            .timeout(Duration::from_secs(10))
            .call()
            .map_err(|e| e.to_string())?;
        response.into_string().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .map_err(AppError::Internal)?;

    let parsed: Value = serde_json::from_str(&body).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut map: HashMap<String, (Vec<u8>, Vec<u8>)> = HashMap::new();
    if let Some(keys) = parsed["keys"].as_array() {
        for key in keys {
            let kid = key["kid"].as_str();
            let n = key["n"].as_str().and_then(|v| URL_SAFE_NO_PAD.decode(v).ok());
            let e = key["e"].as_str().and_then(|v| URL_SAFE_NO_PAD.decode(v).ok());
            if let (Some(kid), Some(n), Some(e)) = (kid, n, e) {
                map.insert(kid.to_string(), (n, e));
            }
        }
    }
    if map.is_empty() {
        return Err(AppError::Internal("Firebase signing keys came back empty".to_string()));
    }
    let mut cache = state.keys.write().await;
    cache.keys = map;
    cache.fetched = Some(Instant::now());
    Ok(())
}

async fn key_for(state: &AppState, kid: &str) -> Result<(Vec<u8>, Vec<u8>), AppError> {
    {
        let cache = state.keys.read().await;
        let fresh = cache
            .fetched
            .map(|t| t.elapsed() < Duration::from_secs(3600))
            .unwrap_or(false);
        if fresh {
            if let Some(found) = cache.keys.get(kid) {
                return Ok(found.clone());
            }
        }
    }
    let can_refetch = {
        let cache = state.keys.read().await;
        cache
            .fetched
            .map(|t| t.elapsed() > Duration::from_secs(60))
            .unwrap_or(true)
    };
    if can_refetch {
        refresh_keys(state).await?;
    }
    let cache = state.keys.read().await;
    cache.keys.get(kid).cloned().ok_or_else(unauthorized)
}

fn decode_json(part: &str) -> Result<Value, AppError> {
    let bytes = URL_SAFE_NO_PAD.decode(part).map_err(|_| unauthorized())?;
    serde_json::from_slice(&bytes).map_err(|_| unauthorized())
}

pub async fn verify_token(state: &AppState, token: &str) -> Result<Claims, AppError> {
    let mut parts = token.split('.');
    let (head, payload, signature) = match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(h), Some(p), Some(s), None) => (h, p, s),
        _ => return Err(unauthorized()),
    };

    let header = decode_json(head)?;
    if header["alg"].as_str() != Some("RS256") {
        return Err(unauthorized());
    }
    let kid = header["kid"].as_str().ok_or_else(unauthorized)?.to_string();
    let (n, e) = key_for(state, &kid).await?;

    let key = RsaPublicKey::new(BigUint::from_bytes_be(&n), BigUint::from_bytes_be(&e)).map_err(|_| unauthorized())?;
    let sig_bytes = URL_SAFE_NO_PAD.decode(signature).map_err(|_| unauthorized())?;
    let hashed = Sha256::digest(format!("{}.{}", head, payload).as_bytes());
    key.verify(Pkcs1v15Sign::new::<Sha256>(), hashed.as_slice(), &sig_bytes)
        .map_err(|_| unauthorized())?;

    let claims = decode_json(payload)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let project = state.cfg.firebase_project_id.clone();
    let exp = claims["exp"].as_i64().unwrap_or(0);
    let iat = claims["iat"].as_i64().unwrap_or(i64::MAX);
    if exp < now - 30 || iat > now + 300 {
        return Err(unauthorized());
    }
    if claims["aud"].as_str() != Some(project.as_str()) {
        return Err(unauthorized());
    }
    let issuer = format!("https://securetoken.google.com/{}", project);
    if claims["iss"].as_str() != Some(issuer.as_str()) {
        return Err(unauthorized());
    }
    let uid = claims["sub"]
        .as_str()
        .filter(|v| !v.is_empty())
        .ok_or_else(unauthorized)?
        .to_string();

    let email_verified = claims["email_verified"].as_bool().unwrap_or(false);
    if state.cfg.require_verified_email && !email_verified {
        return Err(AppError::Forbidden("Verify your email address to continue.".to_string()));
    }

    Ok(Claims {
        uid,
        email: claims["email"].as_str().unwrap_or("").to_lowercase(),
        name: claims["name"].as_str().map(|v| v.to_string()),
        picture: claims["picture"].as_str().map(|v| v.to_string()),
    })
}

fn bearer(parts: &Parts) -> Option<String> {
    parts
        .headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(|t| t.trim().to_string())
}

#[async_trait]
impl FromRequestParts<AppState> for Claims {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer(parts).ok_or_else(unauthorized)?;
        verify_token(state, &token).await
    }
}

#[derive(Clone)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
}

impl AuthUser {
    pub fn is_admin(&self) -> bool {
        self.role == "admin"
    }
}

async fn load_user(state: &AppState, claims: &Claims) -> Result<AuthUser, AppError> {
    let row = sqlx::query("SELECT id, email, full_name, role, status FROM users WHERE id = $1")
        .bind(&claims.uid)
        .fetch_optional(&state.db)
        .await?;
    let row = row.ok_or_else(|| AppError::Unauthorized("Finish signing in to continue.".to_string()))?;
    let status: String = row.try_get("status")?;
    if status == "suspended" {
        return Err(AppError::Forbidden("Your account has been suspended.".to_string()));
    }
    let email: String = row.try_get("email")?;
    let full_name: String = row.try_get("full_name")?;
    Ok(AuthUser {
        id: row.try_get("id")?,
        name: if full_name.is_empty() { email.clone() } else { full_name },
        email,
        role: row.try_get("role")?,
    })
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer(parts).ok_or_else(unauthorized)?;
        let claims = verify_token(state, &token).await?;
        load_user(state, &claims).await
    }
}

pub struct OptUser(pub Option<AuthUser>);

#[async_trait]
impl FromRequestParts<AppState> for OptUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer(parts);
        let user = match token {
            Some(token) => match verify_token(state, &token).await {
                Ok(claims) => load_user(state, &claims).await.ok(),
                Err(_) => None,
            },
            None => None,
        };
        Ok(OptUser(user))
    }
}

pub struct AdminUser(pub AuthUser);

#[async_trait]
impl FromRequestParts<AppState> for AdminUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if user.is_admin() {
            Ok(AdminUser(user))
        } else {
            Err(AppError::Forbidden("Admins only.".to_string()))
        }
    }
}
