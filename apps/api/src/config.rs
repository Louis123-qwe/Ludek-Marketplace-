use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub app_env: String,
    pub trust_proxy: bool,
    pub require_verified_email: bool,
    pub firebase_project_id: String,
    pub cloudinary_cloud_name: Option<String>,
    pub cloudinary_upload_preset: Option<String>,
    pub admin_emails: Vec<String>,
    pub cors_origins: Vec<String>,
}

fn opt(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn list(key: &str, lower: bool) -> Vec<String> {
    opt(key)
        .map(|v| {
            v.split(',')
                .map(|s| if lower { s.trim().to_lowercase() } else { s.trim().to_string() })
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn flag(key: &str) -> Option<bool> {
    opt(key).map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = opt("DATABASE_URL").ok_or_else(|| anyhow::anyhow!("DATABASE_URL is not set"))?;
        let firebase_project_id =
            opt("FIREBASE_PROJECT_ID").ok_or_else(|| anyhow::anyhow!("FIREBASE_PROJECT_ID is not set"))?;
        let app_env = opt("APP_ENV").unwrap_or_else(|| "development".to_string());
        let production = app_env == "production";
        let cors_origins = list("CORS_ORIGINS", false);

        if production {
            if cors_origins.is_empty() {
                anyhow::bail!("CORS_ORIGINS must be set in production");
            }
            if cors_origins.iter().any(|origin| !origin.starts_with("https://")) {
                anyhow::bail!("Every CORS origin must start with https:// in production");
            }
            let secure_db = database_url.contains("sslmode=require")
                || database_url.contains("sslmode=verify-full")
                || database_url.contains("sslmode=verify-ca");
            if !secure_db {
                anyhow::bail!("DATABASE_URL must use sslmode=require in production");
            }
        }

        Ok(Self {
            database_url,
            port: opt("PORT").and_then(|p| p.parse().ok()).unwrap_or(3003),
            trust_proxy: flag("TRUST_PROXY").unwrap_or(production),
            require_verified_email: flag("REQUIRE_VERIFIED_EMAIL").unwrap_or(false),
            app_env,
            firebase_project_id,
            cloudinary_cloud_name: opt("CLOUDINARY_CLOUD_NAME"),
            cloudinary_upload_preset: opt("CLOUDINARY_UPLOAD_PRESET"),
            admin_emails: list("ADMIN_EMAILS", true),
            cors_origins,
        })
    }
}
